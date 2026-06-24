# ChessMate — Architecture Overview

> Generated as the architectural "knowledge graph" for the project (the role the
> `graphify` tool plays locally). This is a high-level map of **what the modules
> are, how they depend on each other, and how data flows**. For deep,
> file-by-file code understanding (the `codebase-memory` role) see
> [`CODEBASE_MEMORY.md`](./CODEBASE_MEMORY.md).

ChessMate is an **offline-first, privacy-first chess game-analysis SPA**. It runs
Stockfish 17 (WASM) entirely in the browser, classifies moves with a reporter
ported from WintrChess, and stores everything on-device. It ships as a PWA and is
wrapped for Android/iOS via Capacitor.

---

## 1. Tech stack (at a glance)

| Layer | Tech |
|---|---|
| UI | React 18 + TypeScript 5 (inline-styled, no CSS framework) |
| Build | Vite 5 |
| State | Zustand (single store, `src/store.ts`) |
| Chess rules | `chess.js` |
| Board | `react-chessboard` |
| Engine | Stockfish 17 Lite (WASM, single-threaded) in a Web Worker |
| Cloud eval | Lichess `cloud-eval` API (optional, network) |
| Storage | `idb-keyval` (IndexedDB) for saved games; `localStorage` for prefs |
| PGN | `@mliebelt/pgn-parser` |
| Schema | `zod` |
| Mobile | Capacitor 8 (Android project under `/android`) |

---

## 2. Layered module map

```
                         ┌─────────────────────────────────────────┐
                         │                  UI                       │
                         │  App.tsx / main.tsx / index.css           │
                         │  screens/  (Home, Analysis, Library)      │
                         │  components/ (EvalBar, EvalGraph,          │
                         │   EngineLines, MoveStrip, ReportSummary,  │
                         │   ShareDialog, NavBar, Splash)            │
                         └───────────────┬───────────────────────────┘
                                         │ reads/dispatches
                         ┌───────────────▼───────────────────────────┐
                         │            STATE  (store.ts, Zustand)       │
                         │  screen · game · currentNode · treeVersion  │
                         │  analysing/analysed · accuracies · history  │
                         └───────┬────────────────────┬───────────────┘
                                 │                    │
              ┌──────────────────▼──────┐   ┌─────────▼─────────────────┐
              │     APP SERVICES (lib/)  │   │    ENGINE LAYER (engine/)  │
              │  importers (PGN/cc/li)   │   │  Engine.ts (UCI worker)    │
              │  library (IndexedDB)     │   │  analyse.ts (full game)    │
              │  classifications (UI map)│   │  realtime.ts (lazy/idle)   │
              │  sounds                  │   │  accuracy.ts (Lichess-strict)│
              └──────────────────┬───────┘   │  cloudEvaluate.ts (Lichess)│
                                 │           │  presets.ts (quick/bal/deep)│
                                 │           └─────────┬─────────────────┘
                                 │                     │
                         ┌───────▼─────────────────────▼───────────────┐
                         │         CORE  (src/core/, WintrChess port)    │
                         │  lib/reporter/  → classify moves, accuracy    │
                         │  lib/stateTree/ → PGN ↔ move tree (parse/render)│
                         │  lib/utils/     → chess/date/string/validate   │
                         │  types/  constants/  resources/(openings)      │
                         └───────────────────────────────────────────────┘
```

**Import direction is strictly downward.** UI → store/lib/engine → core. The
`core/` layer never imports from `engine/`, `lib/`, `screens/`, or `components/`.

### Path alias
`@/*` → `src/core/*` (see `tsconfig.json` / `vite.config.ts`). So `@/types/...`,
`@/constants/...`, `@/lib/reporter/...` all resolve **inside `core/`**. App-level
code (`engine`, `lib`, `screens`, `components`, `store`) is imported with
relative paths.

> ⚠️ Naming gotcha: there are **two** `lib/` folders — `src/lib/` (app services)
> and `src/core/lib/` (WintrChess core). They are different. The `@/lib/...`
> alias always means **`core/lib`**.

---

## 3. The central data structure: the State Tree

Everything orbits a mutable **`StateTreeNode`** tree (`core/types/game/position/StateTreeNode.ts`):

```
StateTreeNode {
  id, mainline:boolean, parent?, children[],
  state: BoardState {
    fen, engineLines[], move?{san,uci}, moveColour?,
    classification?, accuracy?, opening?, ...
  }
}
```

- A game's mainline is the chain of *priority* children (mainline child, else
  first child). `getMainlineChain` / `getNextChild` (store) and `getNodeChain`
  (core) walk it.
- User-played moves during analysis become **variation** branches appended to
  the END of `children`, so the original game is never disturbed (`store.addMove`).
- `treeVersion` (a counter in the store) is bumped to force React re-renders
  whenever the tree is mutated **in place** (evals arriving, classifications,
  new nodes) — because Zustand can't see deep mutations.
- Persistence strips `parent` (cyclic) + trims engine lines via
  `serializeNode`; `deserializeNode` restores parent links on load.

---

## 4. Primary data flows

### A. Import → Analyse → Report
```
HomeScreen (PGN / Chess.com / Lichess)
  → lib/importers  → Game
  → store.loadGame → parseStateTree (core/lib/stateTree/parse) → AnalysedGame
  → AnalysisScreen "Analyse" button
     → engine/analyse.analyseGame:
         for each mainline node:
            try Lichess cloud-eval (deep) ── miss-streak guard ──┐
            else local Stockfish Engine.evaluate(depth,timeLimit)│
         → core reporter: getGameAnalysis (classifications)      │
         → engine/accuracy.getStrictGameAccuracy (Lichess-style) │
            (fallback: core getGameAccuracy)                     │
     → store.finishAnalysis(accuracies)                          │
  → ReportSummary / EvalGraph / MoveStrip render badges & scores ┘
```

### B. Realtime exploration
Navigating the board (or playing a move) lands on a node that may have no evals.
`AnalysisScreen` effect → `realtimeAnalyser.analyseNode` (engine/realtime.ts)
lazily spins up a Stockfish worker, evaluates + classifies that single node, and
shuts the worker down after 30s idle (battery saver). Cancels on navigate-away
via a token.

### C. Save / Load library
`AnalysisScreen` Save → `lib/library.saveGame` → IndexedDB (serialized tree).
`LibraryScreen` → `listGames` summaries → `loadGame` → `store.setLoadedAnalysis`.

### D. Back-button / history sync
`store.ts` maintains a manual `history` stack so the Android/browser Back button
walks screens (and closes the Share dialog first) instead of exiting the app.
`initHistorySync()` is wired at startup (`main.tsx`).

---

## 5. Engine subsystem detail

| File | Responsibility |
|---|---|
| `Engine.ts` | Thin UCI wrapper around the Stockfish Web Worker. `setPosition`, `setLineCount` (MultiPV), `evaluate({depth,timeLimit})`, `stop`, `terminate`. Parses `info depth … score cp/mate … pv …` lines, normalises eval to White's POV, converts UCI→SAN. |
| `analyse.ts` | Full-game pipeline (cloud-first, then local). Emits `AnalysisProgress`. |
| `realtime.ts` | Singleton `realtimeAnalyser` for on-demand single-node eval + classify, idle shutdown. |
| `accuracy.ts` | Faithful Lichess `AccuracyPercent` reimplementation (win% curve, volatility-weighted mean + harmonic mean). Strict; returns `undefined` on eval gaps to trigger fallback. |
| `cloudEvaluate.ts` | Fetch + parse Lichess `cloud-eval`; handles Chess960 castling UCI quirks; 2.5s timeout. |
| `presets.ts` | `quick` (d12), `balanced` (d16), `deep` (d20); persisted in localStorage. |

Engine binaries live in `public/engines/` (`stockfish-17-lite-single.{js,wasm}`).

---

## 6. Core (WintrChess) subsystem detail

- `lib/reporter/report.ts` — `getGameAnalysis(root)` walks the tree and sets
  `classification` per node.
- `lib/reporter/classify.ts` — single-move classification engine.
- `lib/reporter/classification/{brilliant,critical,pointLoss}.ts` — special-case
  detectors.
- `lib/reporter/accuracy.ts` — core (simple) accuracy + `getMoveAccuracy`.
- `lib/reporter/utils/` — chess heuristics: attackers, defenders, pieceSafety,
  pieceTrapped, dangerLevels, criticalMove, opening lookup, extractNode.
- `lib/stateTree/{parse,render}.ts` — PGN ↔ tree.
- `resources/openings.json`, `startingLines.json` — opening book + cached
  starting-position eval.

> This layer is described in the README as "unmodified WintrChess logic." Treat
> it as upstream: prefer changing app/engine layers over editing core, to keep
> GPL-provenance clean and merges easy.

---

## 7. UI surface

| Screen | Role |
|---|---|
| `HomeScreen` | Import: PGN textarea / Chess.com / Lichess (username + month/year). Lists fetched games. |
| `AnalysisScreen` | The big one (~940 lines): board (`react-chessboard`), eval bar/graph, engine lines, move strip, report summary, analyse button + preset picker, arrow modes, autoplay, save, share. |
| `LibraryScreen` | Saved games list, load/delete. |

Shared components: `EvalBar`, `EvalGraph`, `EngineLines`, `MoveStrip`,
`ReportSummary`, `ShareDialog`, `NavBar`, `Splash`. Styling is inline + CSS vars
defined in `index.css` (works inside sandboxed previews — no external CSS).

---

## 8. Notable design decisions & constraints

- **No backend, no accounts, no analytics.** Only outbound network is optional
  (Lichess cloud-eval, Chess.com/Lichess import APIs).
- **Single-threaded WASM** Stockfish (no SharedArrayBuffer / COOP-COEP needed) →
  works on plain static hosting, slower but portable.
- **Mutation + `treeVersion`** instead of immutable state — fast for large trees
  but means every tree edit MUST bump the version or the UI won't update.
- **Strict accuracy fallback chain** keeps numbers sane when evals are partial.
- **Manual history stack** for native back-button etiquette.

---

## 9. Suggested improvement areas (backlog seeds)

These are observations, not commitments — confirm priorities before building:

1. **Testing**: no test suite exists. Engine parsing, accuracy math, importers,
   and serialize/deserialize are pure and highly testable.
2. **Engine performance**: option to use multi-threaded Stockfish where COOP/COEP
   headers are available; cache evals per FEN across sessions.
3. **Accuracy/UX**: progress ETA, cancel granularity, per-move loss tooltip.
4. **Importers**: pagination/“load more”, archive listing, error messages per
   provider, PGN with multiple games.
5. **Library**: search/filter, export, storage-quota handling, tags.
6. **Code health**: split `AnalysisScreen.tsx` (~940 lines) into hooks/subcomponents.
7. **PWA**: offline caching of engine WASM via service worker, update prompts.
8. **A11y**: keyboard nav for the board/move strip, ARIA on controls.

---

*Last updated by the agent while onboarding to the repo. Keep this in sync as
the structure evolves; record the actual changes in `development-changes-history.md`.*
