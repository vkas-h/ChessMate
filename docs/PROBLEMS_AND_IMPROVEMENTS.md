# ChessMate — Problem & Improvement Audit

> ✅ **STATUS (2026-06-24): all items below have been implemented.** See the
> top entry in `../development-changes-history.md` for the per-item mapping to
> files. This document is retained as the rationale/record of the audit.

> A full diagnostic pass over the codebase (UI/UX, performance/analysis speed,
> storage/cache, data integrity, architecture, mobile/PWA, code health). Each
> item has: **what**, **where** (file/line evidence), **impact**, and a
> **suggested fix**. Severity: 🔴 high · 🟠 medium · 🟢 low/polish.
> Nothing here is implemented yet — this is the discussion list.

---

## A. Analysis speed & engine efficiency (biggest wins)

### A1. 🔴 No persistent eval cache across sessions/games
- **Where:** `engine/analyse.ts`, `engine/realtime.ts`, `lib/library.ts`
  (serialize trims to 2 lines).
- **What:** Every analysis re-evaluates positions from scratch. Re-analysing the
  same game, or two games sharing an opening, recomputes everything. Saved games
  keep only 2 lines and there's no FEN→eval store.
- **Impact:** Wasted time/battery; the single biggest analysis-speed lever.
- **Fix:** Add an IndexedDB-backed `evalCache: Map<fen, EngineLine[]>` keyed by
  normalised FEN (+ depth/multipv). Check it before cloud/local in both
  `analyseGame` and `realtimeAnalyser`. Opening positions get near-instant hits.

### A2. 🔴 Cloud + local evals run strictly sequentially (no batching/parallelism)
- **Where:** `analyse.ts` main loop (`await` per node, one position at a time).
- **What:** Each position waits for the previous one. Cloud requests (network,
  ~hundreds of ms each) are serialised; the local engine sits idle while waiting
  on the network and vice-versa.
- **Impact:** A 40-move game = 80 sequential round-trips. Very slow on `deep`.
- **Fix:** (1) Pre-fetch cloud evals for all FENs concurrently (bounded pool,
  e.g. 4–6) up front, then only run local Stockfish for the misses. (2) Optionally
  pipeline: while the engine searches position N, prefetch cloud for N+1.

### A3. 🟠 `timeLimit` defeats the depth target (movetime caps before depth)
- **Where:** `Engine.evaluate` builds `go depth N movetime ms`; presets pair
  e.g. depth 16 / 5000ms.
- **What:** With both set, the engine stops at whichever comes first. On mobile,
  depth 16 often won't finish in 5s, so positions silently get *shallower* evals
  than the preset name implies — and worse, **inconsistent depths across the
  game**, which skews the strict-accuracy math (which assumes comparable evals).
- **Impact:** "Deep" may not be deep; accuracy numbers vary by device speed.
- **Fix:** Decide policy explicitly — either depth-bounded (drop movetime, accept
  variable time) or time-bounded (drop depth) — and surface the *actual* depth
  reached. Don't mix silently.

### A4. 🟠 No multi-threaded engine option
- **Where:** Only `stockfish-17-lite-single` is shipped; `EngineVersion` lists
  multi-thread/full builds but they aren't bundled.
- **What:** Single-threaded WASM is ~3–8× slower than threaded.
- **Impact:** Slow analysis on capable devices.
- **Fix:** Ship a threaded build and feature-detect `crossOriginIsolated`
  (needs COOP/COEP headers). Fall back to single-thread. In the Capacitor APK
  you control headers, so threading is feasible there.

### A5. 🟠 New engine `Worker` is spun up per full analysis; realtime spins its own
- **Where:** `analyse.ts` (`new Engine(...)`), `realtime.ts` (separate engine).
- **What:** WASM init is expensive (load + compile). Two separate engines and a
  fresh one each "Analyse" press pays that cost repeatedly.
- **Fix:** Single shared engine pool/singleton reused by both paths; warm it on
  app/Analysis-screen mount so first eval isn't cold.

### A6. 🟢 `MultiPV 2` for whole-game analysis
- **Where:** `analyse.ts` `setLineCount(2)`.
- **What:** Classification mostly needs the best line + the played move's eval.
  MultiPV 2 roughly doubles search cost per position.
- **Fix:** Evaluate at MultiPV 1 for the bulk pass; fetch the 2nd line lazily
  only when the user opens Engine lines. (Verify the reporter doesn't require 2.)

---

## B. Storage, caching & data integrity

### B1. 🔴 Save uses `JSON.parse(JSON.stringify(record))` — silent data loss risk
- **Where:** `lib/library.ts :: saveGame`.
- **What:** Forcing a JSON round-trip on top of `serializeNode` is redundant and
  drops anything non-JSON (and is a perf cost for big trees). idb-keyval uses
  structured clone already.
- **Fix:** Store the serialized record directly; drop the stringify round-trip.

### B2. 🟠 `listGames()` loads every full record just to build summaries
- **Where:** `lib/library.ts :: listGames` (`get(key)` per game, full tree).
- **What:** Opening the Library deserialises every saved game's entire state
  tree just to show name/result/date. O(total saved data) on each visit.
- **Impact:** Library screen gets slow as the collection grows.
- **Fix:** Store a lightweight summary record alongside the full one
  (`summary:<id>` key), or keep an index list; load full game only on open.

### B3. 🟠 No storage-quota handling or duplicate detection
- **Where:** `saveGame` (no quota check, no dedupe).
- **What:** IndexedDB can throw `QuotaExceededError`; saving the same game twice
  creates duplicates (new UUID each time).
- **Fix:** Try/catch quota with a user message; dedupe by a content hash
  (PGN + players + date) and offer "already saved / update".

### B4. 🟠 "Saved" state can lie after edits
- **Where:** `AnalysisScreen` `saved` flag set true after `onSave`, only reset on
  re-analyse / new game.
- **What:** Add variations after saving → still shows "Saved to library" though
  the saved copy is stale. Also `libraryId` is set on load but `saveGame` always
  creates a NEW record (never updates the loaded one).
- **Fix:** Reset `saved` on any tree mutation; if `libraryId` exists, update that
  record instead of creating a duplicate.

### B5. 🟢 Saved games trimmed to 2 engine lines but realtime expects to re-eval
- **Where:** `serializeNode` (`.slice(0,2)`), reopened games have shallow data.
- **What:** Reasonable for size, but reopened games may re-trigger realtime evals
  on navigation because depths are low. Tie-in with A1 (cache) fixes this.

---

## C. UI / UX

### C1. 🔴 Autoplay "cancel on manual navigation" is a dead no-op effect
- **Where:** `AnalysisScreen`:
  ```
  // Any manual navigation cancels autoplay
  useEffect(() => { /* empty */ }, [node]);
  ```
- **What:** The comment promises manual nav cancels autoplay, but the effect body
  is empty. Tapping a move/graph/engine-line during autoplay does NOT stop it;
  only the nav buttons call `setAutoplay(false)`.
- **Fix:** Track whether a `node` change came from autoplay vs. user; stop
  autoplay on user-initiated changes (or simply `setAutoplay(false)` in
  `goToNode` callers that are user taps).

### C2. 🟠 No visible error/empty states for analysis failures
- **Where:** `startAnalysis` catch just resets flags silently; cloud/engine
  errors vanish.
- **What:** If analysis throws (engine load fail, etc.) the user sees the button
  reset with no explanation.
- **Fix:** Surface an inline error toast/message; distinguish "cancelled" from
  "failed".

### C3. 🟠 No promotion picker — always promotes to queen
- **Where:** `tryMove` hardcodes `promotion: "q"`.
- **What:** Exploring under-promotions (knight/rook/bishop) is impossible.
- **Fix:** Show a small promotion chooser on promoting moves.

### C4. 🟠 Accessibility gaps
- **Where:** Buttons are styled `<button>`s but most lack `aria-label`s (icon-only
  nav/flip/arrow/share); board has no keyboard move entry; color-only result/eval
  cues.
- **Fix:** Add aria-labels to icon buttons, focus states, and ensure
  classification isn't conveyed by color alone (icons already help).

### C5. 🟠 Month/year importer can request future months / has no "load more"
- **Where:** `HomeScreen` defaults to current month/year; selects allow current
  month even if empty; only 50 (lichess) / one month (chess.com) fetched.
- **Fix:** Pagination / "load more months", guard against empty future months,
  clearer per-provider errors.

### C6. 🟢 EvalGraph and EvalBar use *different* win-probability curves
- **Where:** `EvalGraph.getWhiteShare` uses `1/(1+e^(-0.004*cp))`; `accuracy.ts`
  uses Lichess `-0.00368208`; EvalBar likely another mapping.
- **What:** The graph's "advantage" visually disagrees slightly with the accuracy
  model and bar. Minor, but inconsistent.
- **Fix:** Centralise one `winProbability(cp)` helper and reuse everywhere.

### C7. 🟢 Long opening names / long usernames truncation, and badge clipping at
  board edges (already partly clamped) — minor polish.

---

## D. Architecture & code health

### D1. 🟠 `AnalysisScreen.tsx` is ~940 lines doing everything
- **Where:** one file: board, tap-to-move, arrows, badges, autoplay, analysis
  orchestration, presets, share, report.
- **Impact:** Hard to test/maintain; lots of `useMemo` deps on `treeVersion`.
- **Fix:** Extract hooks (`useBoardInteraction`, `useAnalysisRunner`,
  `useArrows`) and subcomponents (`BoardArea`, `AnalysisControls`,
  `ClassificationBanner`).

### D2. 🟠 `treeVersion` manual-invalidation pattern is fragile
- **Where:** store mutates the tree in place; every consumer must subscribe to
  `treeVersion` AND every mutator must bump it.
- **What:** Easy to forget → stale UI; already several `useAppStore(s=>s.treeVersion)`
  "subscribe-only" calls scattered around.
- **Fix:** Either move tree edits through store actions that always bump, or adopt
  immutable updates (immer) for the parts React reads.

### D3. 🟢 Engine `evaluate` end-condition `log.includes("depth 0")`
- **Where:** `Engine.evaluate` ends on `bestmove` OR `includes("depth 0")`.
- **What:** Fragile string match; could match unexpected substrings in some
  builds and end a search early.
- **Fix:** Rely on `bestmove` (and a timeout) as the authoritative terminator.

### D4. 🟢 Two `lib/` trees (`src/lib` vs `src/core/lib`) + `@`→`core` alias
- **What:** Onboarding confusion (documented in CODEBASE_MEMORY). Not a bug, but
  worth a note/comment in code.

### D5. 🟢 `React.StrictMode` double-invokes effects in dev
- **Where:** `main.tsx`.
- **What:** Realtime analyser / history listeners run twice in dev; ensure
  cleanup is idempotent (mostly is). Watch when adding new effects.

---

## E. Mobile / PWA

### E1. 🔴 No service worker → "offline-first" PWA isn't actually offline
- **Where:** `public/` has no SW; `manifest.webmanifest` present but nothing
  caches the app shell or the ~7MB engine WASM.
- **What:** README claims offline-first PWA, but a real offline load won't have
  the engine/app cached. (APK bundles assets, so native is fine; the *web* PWA
  isn't.)
- **Fix:** Add a service worker (e.g. `vite-plugin-pwa`/Workbox) precaching the
  app shell + engine assets; show update prompts.

### E2. 🟠 No `apple-touch-icon` / limited PWA metadata
- **Where:** `index.html` only links manifest; no iOS icons/splash meta.
- **Fix:** Add iOS meta tags for a proper installed experience.

### E3. 🟢 `maximum-scale=1, user-scalable=no` disables zoom (a11y concern)
- **Where:** `index.html` viewport.
- **Fix:** Consider allowing zoom; it's an accessibility anti-pattern.

---

## F. Correctness / edge cases

### F1. 🟠 Strict-accuracy depends on uniform evals; A3 breaks that assumption
- **Where:** `engine/accuracy.ts` (needs an eval for *every* node or it bails to
  fallback) + A3 variable depths.
- **What:** Inconsistent per-position depth → noisier accuracy; one missing eval
  silently downgrades to the simpler average.
- **Fix:** Ensure consistent depth (A3) and log when fallback triggers.

### F2. 🟢 PGN sanitiser regex only fixes one newline pattern
- **Where:** `importers.parsePgn` single `.replace(...)`.
- **What:** Some PGNs (multiple games, odd headers) may fail to parse; error is
  generic.
- **Fix:** More robust parsing + per-error messaging; support multi-game PGN.

### F3. 🟢 Mate-score handling for eval graph/bar at `mate 0`
- **Where:** several `getWhiteShare`/`winPercentFromNode` branches infer the
  winner from `moveColour`; verify it's correct for the root/edge nodes.

---

## Suggested priority order (for discussion)
1. **A1 eval cache** + **A2 cloud parallelism** — largest, most user-visible speed win.
2. **E1 service worker** — makes the core "offline PWA" promise true.
3. **A3 depth/time policy** + **F1** — makes analysis depth & accuracy trustworthy.
4. **C1 autoplay bug**, **B4 stale-save**, **C2 error states** — small, high-value correctness/UX.
5. **B1/B2 storage** — cheap wins, future-proofing.
6. **A4/A5 threaded + shared engine** — bigger lift, big payoff.
7. **D1 refactor AnalysisScreen** — enables everything else safely; pairs with tests.

> No tests exist yet; adding a few pure-function tests (accuracy math, importers,
> serialize/deserialize, engine line parsing) should accompany any of the above.
