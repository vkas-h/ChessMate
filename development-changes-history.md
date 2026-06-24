# ChessMate — Development Changes History

> **Purpose:** a lightweight, running log of what we change as we work on
> ChessMate, so a fresh chat (or a new contributor) can pick up context fast.
> Keep entries brief: *what changed, why, where, and anything to watch out for.*
> Newest entries on top.

**Quick links:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) ·
[`docs/CODEBASE_MEMORY.md`](./docs/CODEBASE_MEMORY.md)

---

## How to use this file (for future-me / next chat)

1. Read the two docs above first for context (architecture + code memory).
2. Re-read invariants in `CODEBASE_MEMORY.md` (esp. the `treeVersion` mutation
   rule and the `@/* → src/core/*` alias).
3. Append a new dated entry below for every meaningful change.
4. Keep `ARCHITECTURE.md` / `CODEBASE_MEMORY.md` in sync when structure or
   behaviour changes; this file is the chronological "what we did" log.

Entry template:
```
## YYYY-MM-DD — <short title>
- **What:** ...
- **Why:** ...
- **Files:** ...
- **Notes/risks:** ...
- **Verified:** build? manual smoke? tests?
```

---

## 2026-06-24 — Native (APK) icon + splash from new logo (update-08)
- **What:** Regenerated the `resources/` source images (used by
  `@capacitor/assets`) from the new knight logo so the Android launcher icon +
  native splash match the app.
- **Files:** `resources/icon.png` (dark bg + knight), `icon-foreground.png`
  (knight, adaptive-safe padding), `icon-background.png` (#1A1A1B),
  `splash.png` / `splash-dark.png` (#0E0E0F + centered knight).
- **To apply on the build machine:**
  `npx capacitor-assets generate --android` then `npm run android:sync`,
  then build the APK (Android Studio: Build → Build APK; or
  `cd android && ./gradlew assembleDebug`).
- **Verified:** web build OK. (Native build runs on the user's machine.)

---

## 2026-06-24 — Real logo (splash, icons, empty states) (update-07)
- **What:** Replaced the `♞` emoji with the real knight logo everywhere.
- **Assets generated** (from the user's 1024² black-bg logo):
  - `public/logo-knight.png` — white knight on TRANSPARENT bg (auto-cropped,
    512²), used on dark UI surfaces.
  - `public/icon-192.png`, `public/icon-512.png` — rounded dark-tile app icons
    with the knight (regenerated; replace the old emoji-ish ones).
  - `public/icon-maskable-512.png` — full-bleed maskable variant (safe area).
- **Wired in:**
  - `Splash.tsx` — emoji tile → logo image on a dark rounded tile.
  - `AnalysisScreen.tsx` empty state → logo image.
  - `LibraryScreen.tsx` empty state → logo image.
  - `vite.config.ts` — manifest icons split any/maskable; logo + maskable
    added to `includeAssets` (PWA precache 56→60 entries).
- **Files:** `public/logo-knight.png`, `public/icon-192.png`,
  `public/icon-512.png`, `public/icon-maskable-512.png`,
  `src/components/Splash.tsx`, `src/screens/AnalysisScreen.tsx`,
  `src/screens/LibraryScreen.tsx`, `vite.config.ts`.
- **Verified:** tsc clean, 15 tests pass, build OK (icons emitted to dist).
- **Note:** the icons are derived from the provided PNG (luminance→alpha key).
  The transparent `logo-knight.png` can also be re-exported as SVG later for
  perfectly crisp scaling if desired.

---

## 2026-06-24 — New color palette + Import redesign (update-06)
- **What:** App-wide recolor to the new palette + Import screen redesign
  inspired by the provided mockup.
- **Palette (applied everywhere; gold → blue):**
  - Primary `#1A1A1B` surfaces, Secondary `#F5F5F7` off-white, Tertiary
    `#007AFF` accent (replaces gold), Neutral `#797676` dim text.
  - Functional: WIN/accent green `#34C759`, LOSS red `#FF453A`.
  - Board squares retuned to a neutral light/slate pair.
  - Classification colours refreshed to iOS-style hues (greens → #34C759,
    blunder → #FF453A, etc.) — still match the badge PNGs + stay semantic.
  - `index.css` `:root` tokens rewritten; `theme-color`/manifest/Capacitor
    bg → `#0E0E0F`; nav/control-bar translucency updated; hardcoded
    `#ecebee`/`#141318` → `#f5f5f7`/`#1a1a1b`; gold rgba → blue.
  - Splash gradient switched to blue (user will swap logo/splash art manually).
- **Import screen (`HomeScreen.tsx`) redesign:**
  - "Data Source" / "Import PGN" heading + subtitle (per source).
  - Card-wrapped forms with labelled fields (person/calendar/file icons),
    username input with inline icon + "e.g. Hikaru" placeholder.
  - Kept month/year fetch (Chess.com is monthly-only) but restyled.
  - "Recent Games" section with "Showing N of M", avatar-initial cards,
    opponent name + ● rating, time control, and WIN/LOSS pills.
  - "LOAD MORE" pagination (reveals 8 at a time) instead of dumping all.
- **Files:** `src/index.css`, `src/screens/HomeScreen.tsx`,
  `src/lib/classifications.ts`, `src/lib/report.ts`,
  `src/components/{EvalBar,EvalGraph,EngineLines,ReportSummary,ShareDialog,Splash,NavBar}.tsx`,
  `src/screens/AnalysisScreen.tsx`, `index.html`, `capacitor.config.ts`,
  `vite.config.ts`.
- **Verified:** tsc clean, 15 tests pass, build OK. No new deps.
- **Note:** logo + splash artwork to be replaced manually by user.

---

## 2026-06-24 — Remember username (update-05)
- **What:** Username no longer has to be retyped every session.
- **How:** Persist usernames **per platform** in localStorage
  (`chessmate:username:chesscom` / `:lichess`). Loaded on mount, saved on a
  successful fetch, and the correct one is filled in when switching between the
  Chess.com / Lichess tabs. (In-session `searchUsername` still takes priority.)
- **Files:** `src/screens/HomeScreen.tsx`.
- **Verified:** tsc clean, 15 tests pass, build OK. No new deps.

---

## 2026-06-24 — Big UI redesign + cross-screen fixes (update-04)
- **What:** Split the Analyse tab into a clean **board view** and a separate
  **Game Report page** (Chess.com-style), plus a batch of UI fixes. Full
  rationale + research in `docs/UI_REDESIGN_PLAN.md`.
- **Decisions:** report opens via a "View Game Report →" pushed page with a
  "⟵ Board" back (Android back wired in store via `analysisView`); our own
  **dark** promotion picker for drag AND click (library's white modal disabled);
  Library shows raw `1-0/0-1/½`; move strip + expandable 2-column full list.
- **New files:**
  - `src/screens/GameReport.tsx` — report page: players/opening header, big
    accuracy cards w/ descriptors, restyled tappable eval graph, tappable
    move-quality rows, **Key Moments** list (jump to move), Save/Share.
  - `src/lib/report.ts` — `accuracyDescriptor`, `getKeyMoments`.
  - `src/components/FullMoveList.tsx` — 2-column whole-game move sheet.
- **Changed:**
  - `store.ts` — added `analysisView: "board"|"report"` + `setAnalysisView`,
    history/back integration (report → board), reset to board on load.
  - `AnalysisScreen.tsx` — removed inline report block; added "View Game
    Report" button; renders `GameReport` when `analysisView=="report"`; drag
    promotions now use our dark picker (`onPromotionCheck` always false,
    `autoPromoteToQueen=false`); move strip + "all moves" expand button; depth
    warning toned down to a tiny inline note.
  - `EvalGraph.tsx` — restyled (shaded white-advantage area on dark, midline,
    crisp outline), accepts `height`/`onJump`.
  - `ReportSummary.tsx` — tappable classification rows + accuracy descriptors.
  - `LibraryScreen.tsx` — search + sort (recent/accuracy), inline delete
    confirm, bottom padding, raw result tags.
  - `HomeScreen.tsx` — bottom padding so last card clears nav; privacy footer
    fills empty space on the PGN tab.
  - `EngineLines.tsx` — right-edge fade mask on overflowing lines.
  - `tests/run.ts` — added `accuracyDescriptor` tests (now 15 passing).
- **Verified:** tsc clean, 15 tests pass, `npm run build` OK.
- **⚠ Apply note:** big change set — extract update-04 over the project and
  hard-refresh / restart `npm run dev`. No new deps (no `npm install` needed).

---

## 2026-06-24 — Promotion dialog clipping fix (update-03)
- **What:** The native promotion picker was cut off when promoting on the
  top row.
- **Cause:** react-chessboard's `default` promotion dialog anchors at the
  square and `translate(-1sq, -1sq)`; on the top rank that pushes it above
  the board, where the board wrapper's `overflow:hidden` clips it.
- **Fix:** `promotionDialogVariant="modal"` on `<Chessboard>` — a
  full-width, vertically-centered bar that always stays inside the board,
  so it can't be clipped regardless of promotion rank.
- **Files:** `src/screens/AnalysisScreen.tsx`.
- **Verified:** tsc clean, 14 tests pass, build OK.

---

## 2026-06-24 — Promotion bugs: root-cause fix (update-02)
- **What:** Fixed the promotion **double-dialog** and the **out-of-turn /
  illegal-drag promotion** prompt.
- **Root cause:** `react-chessboard` v4.7.3 has its OWN built-in promotion
  dialog. Its default `onPromotionCheck` is purely geometric (wP on rank
  7 → 8, file dist ≤ 1) — it does NOT check legality or whose turn it is.
  So on a drag it opened the board's dialog AND our custom `onPieceDrop`
  opened a second one (double dialog); and it fired for illegal/out-of-turn
  pawn drags (premove-promote).
- **Fix (in `AnalysisScreen.tsx`):**
  - Provide a **legality-aware `onPromotionCheck`** (uses chess.js legal
    moves) so the board's dialog only opens for a real promotion on the
    correct turn.
  - Handle the board's dialog selection via **`onPromotionPieceSelect`**
    (`"wQ"`→`"q"`), and make `onPieceDrop` defer to the native dialog for
    promotions (no second custom dialog on drags).
  - Keep our **custom picker only for tap-to-move** (clicks don't trigger
    the board's drag dialog), via `tryMove`/`completePromotion`.
  - Split move logic into `isPromotion` / `commitMove` / `tryMove`.
- **Result:** single dialog on drag; custom dialog on click; no dialog and
  snapback for illegal/out-of-turn drags.
- **Files:** `src/screens/AnalysisScreen.tsx`, `tests/run.ts` (promotion
  tests added earlier remain).
- **Verified:** `tsc` clean, 14 tests pass, `npm run build` OK. Logic
  traced for drag-promo, click-promo, capture-promo, out-of-turn drag.
- **⚠ Apply note:** extract `ChessMate-update-02.zip` over the project and
  **hard-refresh / restart `npm run dev`** (stale dev/browser cache was
  why update-01 appeared not to take).

---

## 2026-06-24 — Full audit fix batch (perf, storage, UX, PWA, tests)
- **What:** Implemented fixes for every item in
  `docs/PROBLEMS_AND_IMPROVEMENTS.md`. Summary by area:

  **Analysis speed / engine**
  - A1 — Added a persistent **eval cache** (`src/engine/evalCache.ts`):
    FEN→engine-lines in IndexedDB + in-memory layer, FEN normalised
    (drops move counters so transpositions share a slot), LRU prune,
    `clearEvalCache`. Wired into `analyse.ts` (pass 0) and `realtime.ts`.
  - A2 — **Parallel cloud prefetch**: `getCloudEvaluationsBatch` (bounded
    pool, de-duped) in `cloudEvaluate.ts`; `analyse.ts` now does
    cache → parallel-cloud → local Stockfish (was sequential per node).
  - A3 — Engine `evaluate` gained a `mode: "depth" | "time"` policy;
    default depth-bounded (movetime is only a safety ceiling) so the
    preset's depth promise is honest. Tracks `lastDepthReached`;
    `analyseGame` returns `consistentDepth`.
  - A5 — **Shared engine pool** (`src/engine/enginePool.ts`) reused by
    full + realtime analysis; warmed on AnalysisScreen mount; `analyse`
    `stop()`s (keeps warm) instead of terminating.
  - A6 — Bulk pass uses **MultiPV 1** (panel still gets 2 via realtime).
  - D3 — Engine end-condition now only `bestmove` (removed fragile
    `includes("depth 0")`).

  **Storage / data integrity**
  - B1 — Dropped redundant `JSON.parse(JSON.stringify())` in `saveGame`.
  - B2 — `listGames` now reads small **summary records** (`gamesum:`),
    not full trees; on-the-fly migration for legacy records.
  - B3 — **Quota handling** (`StorageQuotaError`) + **dedupe** by content
    hash (FNV-1a of players+date+pgn).
  - B4 — Save **updates** the existing library record (uses `libraryId`)
    instead of duplicating; "Saved" badge reverts on any later tree edit.

  **UI / UX**
  - C1 — **Autoplay** now actually cancels on manual navigation (the old
    effect body was empty).
  - C2 — Inline **analysis error** + **depth-warning** messages.
  - C3 — **Promotion picker** dialog (was always auto-queen).
  - C4 — `aria-label`s on icon-only buttons + promotion dialog roles.
  - C5 — HomeScreen guards against requesting a **future month**.
  - C6 — Single shared **win-probability** model
    (`src/core/lib/utils/winProbability.ts`) used by EvalBar, EvalGraph
    and accuracy (were three different sigmoids).

  **Architecture / health**
  - D1 — Extracted analysis lifecycle into `useAnalysisRunner` hook,
    shrinking `AnalysisScreen.tsx`.
  - Added a tiny **test runner** (`tests/run.ts`, `npm test`) — 9 tests
    for winProbability / FEN normalisation / module sanity.

  **PWA / mobile**
  - E1 — Added **`vite-plugin-pwa`** (Workbox): precaches app shell +
    ~7MB engine WASM (offline now real); NetworkFirst for lichess/chess.com.
  - E2 — iOS `apple-touch-icon` + apple-mobile-web-app meta.
  - E3 — Removed `maximum-scale/user-scalable=no` (zoom allowed).
  - Removed static `public/manifest.webmanifest` (plugin generates it).

- **Files:** new — `src/core/lib/utils/winProbability.ts`,
  `src/engine/evalCache.ts`, `src/engine/enginePool.ts`,
  `src/screens/useAnalysisRunner.ts`, `tests/run.ts`,
  `docs/PROBLEMS_AND_IMPROVEMENTS.md`. Modified — `engine/Engine.ts`,
  `engine/analyse.ts`, `engine/realtime.ts`, `engine/accuracy.ts`,
  `engine/cloudEvaluate.ts`, `lib/library.ts`, `screens/AnalysisScreen.tsx`,
  `screens/HomeScreen.tsx`, `components/EvalBar.tsx`,
  `components/EvalGraph.tsx`, `vite.config.ts`, `index.html`, `package.json`.
- **Notes/risks:** Bundle is one 1MB JS chunk (code-splitting still a
  future task). The eval cache normalises FENs by position (ignores move
  number) — correct for engine eval but means repetition-sensitive
  positions are treated as identical (acceptable for static eval).
  `vite-plugin-pwa` + `tsx` were added as devDeps (run `npm install`).
- **Verified:** `npm test` → 9 passed; `npm run build` → OK (tsc clean,
  SW precache 56 entries / 8.25 MB).

---

## 2026-06-24 — Onboarding & reference docs (no code changes)
- **What:** Cloned the repo, read the full codebase, and produced
  `docs/ARCHITECTURE.md` (architectural overview / module map / data flows) and
  `docs/CODEBASE_MEMORY.md` (function-level memory, invariants, gotchas). Created
  this history log.
- **Why:** Establish shared context before improving the app, and stand in for
  the requested `graphify` (architecture) and `codebase-memory` (deep code
  understanding) tools — both are local agent/MCP tools that can't run as live
  servers in this environment, so their *output* is reproduced here as durable
  docs.
- **Files:** `docs/ARCHITECTURE.md` (new), `docs/CODEBASE_MEMORY.md` (new),
  `development-changes-history.md` (new). No source files touched.
- **Notes/risks:** None — documentation only. The repo at this point is at git
  HEAD `77b5795` (Add GPL-3.0), version `0.1.0`.
- **Verified:** Docs only — no source changed. Baseline health check passed:
  `npm install` (500 pkgs) OK and `npx tsc --noEmit` exits 0 (clean type-check)
  at HEAD `77b5795`.

### Key facts captured for next time
- Stack: React 18 + TS 5 + Vite 5, Zustand store, chess.js, react-chessboard,
  Stockfish 17 Lite WASM (single-thread Web Worker), idb-keyval, Capacitor 8.
- Central structure: mutable `StateTreeNode` tree; UI updates rely on bumping
  `treeVersion`.
- `@/*` alias points to `src/core/*` (WintrChess port, treat as upstream).
- Engine pipeline: cloud-eval first (Lichess) → local Stockfish fallback →
  WintrChess classify → strict Lichess-style accuracy (with fallback).
- Biggest file / refactor candidate: `src/screens/AnalysisScreen.tsx` (~940 LOC).
- No tests exist yet.

---

## Backlog / ideas (move into dated entries as we tackle them)
- [ ] Add a test suite (pure targets: Engine line parsing, `accuracy.ts`,
      importers, serialize/deserialize).
- [ ] Split `AnalysisScreen.tsx` into hooks + subcomponents.
- [ ] Per-FEN eval cache persisted across sessions.
- [ ] Importer improvements (load-more, better per-provider errors, multi-game PGN).
- [ ] Library search/filter/export + storage-quota handling.
- [ ] PWA service-worker caching for engine WASM + update prompt.
- [ ] Accessibility pass (keyboard board nav, ARIA).
- [ ] Optional multi-threaded Stockfish where COOP/COEP headers are available.
