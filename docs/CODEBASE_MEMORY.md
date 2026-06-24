# ChessMate — Codebase Memory

> Deep, function-level reference (the role the `codebase-memory` tool plays
> locally): the non-obvious facts, invariants, gotchas, and "why" behind the
> code, so a fresh session can get productive fast. Pair with
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the big-picture map.

Conventions used below: `path :: symbol` = file and the symbol of interest.

---

## Critical invariants (read first)

1. **Bump `treeVersion` after any in-place tree mutation.** The store mutates the
   `StateTreeNode` tree directly (pushing children, attaching `engineLines`,
   `classification`, `accuracy`). Zustand only re-renders on top-level state
   changes, so every deep mutation must be followed by `bumpTreeVersion()` /
   `set({treeVersion: ...+1})`. Forgetting this = "analysis ran but UI didn't
   update" bugs.

2. **`@/*` resolves to `src/core/*`, NOT `src/`.** So `@/lib/reporter/...` is the
   WintrChess core lib, while app services are `../lib/...` (relative). Two
   different `lib/` trees. Don't cross them.

3. **Evaluations are always normalised to White's POV.** `Engine.evaluate`
   negates the score when it's Black to move (`this.position.includes(" b ")`).
   Cloud evals from Lichess are already White-POV. All downstream accuracy/eval
   code assumes White-POV.

4. **`getTopEngineLine` = max of `depth - index`.** Picks the deepest line with
   the lowest MultiPV index (`core/types/.../EngineLine.ts`). Used everywhere a
   "current best eval" is needed.

5. **Variations never disturb the imported mainline.** New user moves are pushed
   to the END of `children`; the mainline child keeps priority via
   `getNextChild` (prefers `child.mainline`, else `children[0]`).

6. **Core layer is treated as upstream (WintrChess, GPL-3.0).** Prefer changing
   `engine/`, `lib/`, UI over editing `core/`. Keeps provenance + merges clean.

---

## File-by-file memory

### Entry / shell
- `src/main.tsx` — mounts React, calls `initHistorySync()`.
- `src/App.tsx` — root layout (max-width 560 mobile column). Switches screen by
  `store.screen`. Splash shows **once per page load** (`splashDone` local state;
  tab switches don't remount App). `key={screen}` triggers the `.screen-fade`
  animation on screen change.
- `src/index.css` — design tokens as CSS vars (`--accent`, `--surface-*`,
  `--text-*`, `--r-sm/md/lg`, `--nav-height`, `--ease`), `.skeleton`, `.spin`,
  `.screen-fade`, safe-area handling. Inline styles elsewhere reference these.

### Store — `src/store.ts` (Zustand, the brain)
- State: `screen`, `game:AnalysedGame`, `currentNode`, `treeVersion`, `flipped`,
  `gameLoaded`, `analysing`, `analysisProgress`, `analysed`, `accuracies`,
  `libraryId`, `shareOpen`, `searchResults`/`searchUsername`.
- Navigation helpers: `getNextChild`, `getMainlineChain` (exported).
- Move nav: `goToNode(node, silent?)` (plays move sound unless silent),
  `stepForward/Backward`, `goToStart/End` (End follows the CURRENT line, so it
  stays in a variation if you're in one).
- `addMove(move)` — dedupes against existing children; else creates a non-mainline
  variation node with `id = uniqueId("user")`, plays sound, bumps version.
- `loadGame(game)` — builds `AnalysedGame` via `parseStateTree`, resets analysis
  flags, pushes a history entry, sets screen `analysis`.
- `setLoadedAnalysis(game, accuracies)` — used by Library load (already analysed).
- `finishAnalysis(accuracies)` — flips flags + bumps version.
- **History sync** (module-level `historyDepth`, `suppressNextPop`):
  - `pushEntry` on drill-down (load game) + share dialog open.
  - `replaceEntry` on tab switches (siblings) and going to `home`.
  - `initHistorySync` listens to `popstate`: closes share dialog first, else
    navigates to `event.state.screen`; consumes duplicate entries so Back always
    does something. `setShareOpen(false)` from UI uses `suppressNextPop` +
    `history.back()` to keep the stack balanced.

### Engine layer — `src/engine/` (post-2026-06-24 refactor)
- **`enginePool.ts :: enginePool`** — singleton shared Stockfish worker
  reused by BOTH full-game and realtime analysis. `acquire(multipv)`,
  `warm()`, `stop()` (keep worker), `terminate()` (kill worker).
- **`evalCache.ts`** — persistent FEN→engineLines cache (IndexedDB + memory).
  `normaliseFen` drops halfmove/fullmove counters (transpositions share a
  slot). `getCachedLines(fen,minDepth)`, `putCachedLines`, `hydrateEvalCache`,
  `clearEvalCache`. Key prefix `eval:`, LRU prune at 5000 entries.
- **`cloudEvaluate.ts :: getCloudEvaluationsBatch`** — concurrent (bounded
  pool, de-duped) cloud prefetch; returns `Map<fen, lines>` (misses absent).
- `analyse.ts` pipeline is now: cache → parallel cloud → local (MultiPV 1,
  depth-bounded). Returns `{accuracies, cloudHits, cacheHits, consistentDepth}`.
  Progress stages: `preparing → evaluating → classifying → done`.
- `Engine.evaluate` takes `mode: "depth"|"time"`; exposes `lastDepthReached`;
  terminates only on `bestmove`.
- `core/lib/utils/winProbability.ts` — the ONE win-prob model (Lichess
  constant) shared by EvalBar/EvalGraph/accuracy.

### Engine layer (original notes) — `src/engine/`
- `Engine.ts :: class Engine`
  - `new Worker("/engines/" + version)`, sends `uci`, sets start position.
  - `consumeLogs(command, endCondition, onLog?)` — promise that posts a command
    and collects worker messages until `endCondition` (e.g. line starts with
    `bestmove`). Cleans up listeners.
  - `evaluate({depth,timeLimit,onEngineLine?})` — `go depth N [movetime ms]`,
    parses `info depth … multipv … score cp|mate … pv …`, builds `EngineLine`
    with UCI→SAN conversion on a temp board (skips `currmove` lines). Returns all
    lines seen.
  - `stop()` aborts in-flight search; `terminate()` quits worker.
- `analyse.ts :: analyseGame(game, opts)`
  - Defaults: `depth 16`, `timeLimit 5000`, `useCloud true`.
  - One `Engine` with `MultiPV 2`. For each mainline node: skip if existing depth
    ≥ target; else try cloud (with **miss-streak guard**, `CLOUD_MISS_LIMIT 5`)
    then fall back to local. Emits `AnalysisProgress {progress, stage, cloudHits}`
    (`evaluating`→`classifying`→`done`). `engine.terminate()` in `finally`.
  - After eval: `getGameAnalysis` (core classify) then
    `getStrictGameAccuracy || getGameAccuracy` (fallback).
  - `countClassifications(root)` — tallies per classification per colour.
- `realtime.ts :: realtimeAnalyser` (singleton `RealtimeAnalyser`)
  - `MIN_DEPTH 12`, `IDLE_SHUTDOWN_MS 30_000`. Lazy `getEngine()` (MultiPV 2),
    `touchIdleTimer()` resets shutdown. `currentToken` guards stale async results.
  - `needsEvaluation(node)`, `analyseNode(node,{onUpdate})` — cloud-or-local eval,
    then classify + per-move accuracy (`getMoveAccuracy`) — mirrors report.ts so
    badges show on sideline moves. `cancel()` bumps token + stops engine;
    `shutdown()` terminates.
- `accuracy.ts :: getStrictGameAccuracy(root)` — Lichess `AccuracyPercent` port:
  win% curve `50+50*(2/(1+e^(-0.00368208cp))-1)` (cp clamped ±1000), move
  accuracy `103.1668*e^(-0.04354*winDiff)-3.1669(+1)` clamped [0,100], game score
  = mean of volatility-weighted mean and **harmonic mean** (punishes blunders).
  Window size `clamp(moves/10, 2, 8)`, weights `clamp(stddev(window), 0.5, 12)`.
  Returns `undefined` if **any** position lacks an eval (→ caller falls back).
  `mate` handling: +→100, −→0, mate 0 depends on who just moved.
- `cloudEvaluate.ts :: getCloudEvaluation(fen, targetCount=2, timeoutMs=2500)` —
  `fetch https://lichess.org/api/cloud-eval?fen=…&multiPv=…` with AbortController
  timeout. Maps `pvs` → `EngineLine[]` (`source: LICHESS_CLOUD`, `depth` from
  response). Handles Chess960 castling via `lichessCastlingMoves` map. Throws if
  not in DB / no usable lines (caller treats as miss).
- `presets.ts` — `quick`(d12/2s), `balanced`(d16/5s), `deep`(d20/12s), all
  `useCloud:true`. Persisted under `localStorage["chessmate:preset"]`.

### App services — `src/lib/`
- `importers.ts`
  - `parsePgn(pgn)` — sanitises PGN, parses with `@mliebelt/pgn-parser`, reads
    tags (`White/Black`, `*Elo`, `*Title`, `Result`, `FEN`, `Variant`), validates
    FEN (`chess.js validateFen`), maps `Result` per colour. Defaults usernames to
    "White"/"Black".
  - `getChessComGames(user,month,year)` — `api.chess.com/pub/player/.../games/YYYY/MM`.
    404 → `[]`. Reverses (newest first), filters to chess/chess960, maps time
    class + result codes (big `chessComResults` map) + `end_time`.
  - `getLichessGames(user,month,year)` — NDJSON games API (`max=50`,
    `pgnInJson=true`) with since/until month bounds. Handles AI opponents
    (`Stockfish <level>`), winner→results, speed→TimeControl.
- `library.ts` — IndexedDB via `idb-keyval`, key prefix `game:`.
  - `saveGame(game, accuracies)` — `crypto.randomUUID()`, deep-clones tree,
    `serializeNode` (strips parent + trims to 2 engine lines), JSON round-trips,
    stores `SavedGameRecord`.
  - `listGames()` — summaries (players/result/date/accuracies), newest first by
    `savedAt`.
  - `loadGame(id)` — restores via `deserializeNode` (re-links parents).
  - `deleteGame(id)`.
- `classifications.ts` — UI maps: `classificationColours`, `classificationNames`,
  `classificationIcon(c)` → `/img/classifications/<c>.png`, `reportOrder`.
- `sounds.ts` — cached `Audio` per name in `/audio/`. `playMoveSound(move,isCheck)`
  picks check/promote/castle/capture/move; `playGameEndSound()`. Autoplay errors
  swallowed.

### Core (WintrChess) — `src/core/`
- `types/game/position/StateTreeNode.ts` — the tree type (zod schema with lazy
  `children`/`parent` getters). Key fns: `serializeNode`/`deserializeNode`,
  `findNodeRecursively(root,pred,backwards?)`, `getNodeChain(root,expand?)`
  (priority chain, or full tree if expand), `getNodeParentChain`,
  `getNodeMoveNumber` (decimal .5 for black), `getNodeSiblings`,
  `addChildMove(node,san)` (dedupes; sets `mainline` if parent is mainline w/o
  mainline child).
- `types/game/position/EngineLine.ts` — `getTopEngineLine` (max depth−index),
  `getLineGroupSibling`, `pickEngineLines`, `isEngineLineEqual`.
- `constants/EngineVersion.ts` — enum incl. `STOCKFISH_17_LITE` (the shipped one)
  and `LICHESS_CLOUD`.
- `constants/utils.ts` — `STARTING_FEN`, `defaultRootNode` (uses
  `startingLines.json` cached eval), `defaultAnalysedGame`, `pieceNames`,
  `pieceValues`, `lichessCastlingMoves`.
- `lib/reporter/` — classification + accuracy engine (report, classify,
  classification/{brilliant,critical,pointLoss}, accuracy, expectedPoints,
  utils/{attackers,defenders,pieceSafety,pieceTrapped,dangerLevels,criticalMove,
  opening,extractNode}).
- `lib/stateTree/{parse,render}.ts` — PGN ↔ tree (`parseStateTree` used by store).
- `resources/{openings,startingLines}.json`.

### UI — `src/screens/` & `src/components/`
- `HomeScreen.tsx` — segmented source control (PGN/Chess.com/Lichess), month/year
  selects, `fetchGames`/`importPgn`, results list with result-colour left border,
  skeleton loaders. Search state persists in store across tab switches.
- `AnalysisScreen.tsx` (~940 lines — refactor candidate) — board +
  realtime-analysis effect (eval/classify on navigate), board width sizing,
  preset picker (persisted), arrow modes (`off`/`continuation`/`alternative`,
  persisted under `chessmate:arrowMode`), autoplay, analyse w/ AbortController,
  save, share dialog, eval bar/graph, engine lines, move strip, report summary.
- `LibraryScreen.tsx` — saved games list, load/delete.
- Components: `EvalBar`, `EvalGraph`, `EngineLines`, `MoveStrip`,
  `ReportSummary`, `ShareDialog` (open state in store for Back), `NavBar`
  (3 tabs: Import/Analyse/Library), `Splash`.

---

## Build / run / mobile
- `npm run dev` (Vite), `npm run build` (`tsc --noEmit && vite build`),
  `npm run preview`.
- `npm run android:sync` (build + `cap sync`), `npm run android:open`.
- Engine WASM is a static asset in `public/engines/`; served at `/engines/...`.

## Persisted keys
- localStorage: `chessmate:preset`, `chessmate:arrowMode`.
- IndexedDB (idb-keyval): `game:<uuid>` records.

## Known sharp edges
- Deep mutation + `treeVersion` (see invariant #1).
- Strict-accuracy fallback hides eval gaps silently (returns undefined →
  simple accuracy). If numbers look "too nice," check for missing evals.
- Cloud miss-streak guard stops cloud after 5 misses for the rest of a run.
- `AnalysisScreen.tsx` is large and stateful — change carefully.
- No automated tests yet — verify by `npm run build` + manual smoke at minimum.

---

*Update this file whenever you learn something non-obvious or change behaviour.
Log the actual edits in `development-changes-history.md`.*
