# ChessMate — UI Redesign & Fixes Plan

> ✅ **STATUS (2026-06-24): IMPLEMENTED in update-04.** Decisions taken:
> Q1 = "View Game Report →" pushed page (+ "⟵ Board", Android-back wired);
> Q2 = our own dark promotion picker for drag AND click (library's white modal
> disabled); Q3 = Library shows raw 1-0/0-1/½; Q4 = horizontal strip + an
> expandable 2-column full move list; Q5 = everything. See change history.

> Original proposal below. Deep-research plan for splitting
> analysis into an Analysis page + a separate Game Report page (Chess.com-style),
> plus a batch of UI/UX fixes found across all current screens.
> Decide what to keep, then we implement in one batch.

---

## 0. Research takeaways (what to copy, what to avoid)

I read through Chess.com & Lichess user feedback on their "split report vs.
analysis" designs. The community **loves the idea but hates common mistakes**.
Lessons baked into this plan:

**❌ Avoid (the things people hate about Chess.com's split):**
1. Eval graph **vanishing** when you navigate moves → keep the graph reachable
   from the board page too, not only the report.
2. Move list becoming **horizontal-scroll only** with ~5 moves visible → keep a
   readable move list; offer a 2-column/full view.
3. Forcing you to **toggle back and forth** to see your move vs. the best move →
   keep our existing "X was the best move" + arrow (we already win here).
4. Information **scattered** so simple tasks need many taps → 1 tap to jump
   between Analysis ⇄ Report; "jump to next mistake" button.
5. **White panels in dark mode** (Chess.com's #1 complaint) → our promotion modal
   currently has this exact bug; fix it.

**✅ Copy (what works):**
- A dedicated **Game Report** view: big accuracy numbers, eval graph, move-quality
  tallies, opening name, "jump to key moments".
- A clean **Analysis board** view focused on: board, eval bar, engine lines,
  move list, navigation.
- Clear entry point (a "Game Report" button/tab on the analysis page).

---

## 1. The core change: split into two pages

Today everything is one long scroll in `AnalysisScreen.tsx` (~1100 lines):
board → engine → moves → nav → toolbar → presets → analyse → eval graph →
report → save. That's why it feels crowded.

### Proposed structure

```
Bottom tabs:  [ Import ]   [ Analyse ]   [ Library ]      (unchanged)

ANALYSE tab now has TWO sub-views, toggled by a segmented control or a
"Game Report" button that appears once a game is analysed:

  ┌─ Analysis (board) ──────────┐     ┌─ Game Report ───────────────┐
  │ player row (top)            │     │ ← Back to board             │
  │ eval bar + board + badge    │     │ Opening name                │
  │ player row (bottom)         │     │ ┌─────────┬─────────┐       │
  │ classification banner       │ ⇄   │ │ White % │ Black % │       │
  │ "X was the best move"       │     │ └─────────┴─────────┘       │
  │ ENGINE lines (collapsible)  │     │ Eval graph (tap to jump)    │
  │ Move list                   │     │ Move-quality tallies        │
  │ nav controls (fixed)        │     │ Key moments (blunders…)     │
  │ Autoplay · Arrow · Share    │     │ Save · Share PGN            │
  │ presets + [Analyse / Report]│     │                             │
  └─────────────────────────────┘     └─────────────────────────────┘
```

- **Before analysis:** Analyse tab shows only the board view with the
  preset picker + "Analyse game" CTA (clean, no empty report area).
- **After analysis:** a prominent **"View Game Report →"** button appears under
  the board; tapping it slides to the Report page. A small **"⟵ Board"** returns.
- The **eval graph stays available** on BOTH: full report has the big one; the
  board page can keep a compact strip (optional) so context isn't lost.
- Navigation between the two should integrate with the existing history/back
  stack in `store.ts` (back button returns board → tab, etc.).

### Implementation approach (low-risk)
- Add a local view state on the Analyse tab: `view: "board" | "report"` (or a
  new `Screen` value `"report"`). Local state is simpler and avoids touching the
  global history logic much; a `Screen` value integrates Android back better.
  **Recommendation:** local `view` state + push a history entry when opening the
  report so Android back closes it.
- Move the report block (`EvalGraph` + `ReportSummary` + save) out of
  `AnalysisScreen.tsx` into a new `GameReport.tsx` screen/section.
- This also finally tames the 1100-line file (pairs with the earlier
  `useAnalysisRunner` extraction).

---

## 2. Game Report page — what goes on it

Modeled on Chess.com's report, adapted to our data:

1. **Header:** players + ratings, result, opening name (we already detect
   `node.state.opening`), time control.
2. **Accuracy cards:** the two big % (already have). Add a 1-line descriptor
   (e.g. "Great" / "Good" / "Inaccurate") per side based on thresholds.
3. **Eval graph (large):** the area chart, tappable to jump to that move — and
   tapping a move should **deep-link back to the board** at that position.
4. **Move-quality tallies:** the classification breakdown (have it) — make each
   row **tappable** to jump to the first move of that type (Chess.com-like
   "review your blunders").
5. **Key moments:** auto-list the biggest swings (blunders/mistakes/brilliant) as
   tappable cards → jump to board at that move. (New, high value, easy from the
   tree.)
6. **Actions:** Save to library, Share/Export PGN.
7. **Estimated rating / ACPL (optional later):** nice-to-have.

---

## 3. UI/UX fixes found across all current screens

Severity: 🔴 important · 🟠 medium · 🟢 polish

### Import screen
- 🟠 **Huge empty space** below the form on tall phones (PGN/Chess.com/Lichess
  tabs). Vertically center the content, or add a "Recent imports" / tip block.
- 🟢 The Chess.com/Lichess result list's **last card hides under the bottom nav**
  (`nitin8verma` row clipped). Increase bottom padding on the scroll area.
- 🟢 Loading skeletons already good; keep.

### Analysis (board) screen
- 🔴 **Promotion modal is white** (react-chessboard `modal` variant) — violates
  dark theme (the exact complaint Chess.com users hate). Fix: style the promotion
  dialog dark, OR go back to our own custom centered picker (dark, already
  themed) for BOTH drag and click, and disable the board's native dialog.
  → Recommended: **use our own dark picker everywhere**, set
  `autoPromoteToQueen={false}` + handle via `onPromotionCheck` returning false
  and opening our modal. (Cleanest + on-brand.)
- 🟠 **Everything-in-one-scroll** crowding → solved by the split (section 1).
- 🟠 **Engine line panel overflow**: lines run to the screen edge with a hard
  cutoff. Add a fade mask on the right + clearer "more" affordance.
- 🟢 **Move list is horizontal-only** (research says people dislike this). Offer
  an expand to a 2-column full move list (sheet/overlay) for whole-game view.
- 🟢 Depth warning banner is a bit shouty → make it a small inline ⓘ note.

### Game Report (currently inline)
- 🟠 **Eval graph styling**: solid white area on dark is stark. Shade white
  advantage above the midline and a darker fill below; thinner current-move
  marker; subtle grid. (Use our shared `winProbability` for the curve.)
- 🟢 Make tallies + graph **interactive** (jump to move) — currently static.

### Library screen
- 🔴 **Result perspective inconsistency:** Library shows raw `1-0`/`0-1`
  (white's result), but the Import list shows the result from **the searched
  user's** perspective (WIN/LOSS). Same game (`RomeLondon vs vkaashh`) reads
  "1-0" in Library but "LOSS" in Import. Pick ONE convention. Recommendation:
  Library shows raw score `1-0/0-1/½` (it has no "me" context) but ALSO color it
  and keep it consistent; or store the user's perspective at save time.
- 🟠 **No search/filter/sort** — fine for 2 games, painful at 50. Add a search
  box + sort (date/accuracy).
- 🟢 Lots of empty space when few games (same as Import).
- 🟢 Delete has no confirm → accidental taps wipe a game. Add a quick confirm
  (or undo snackbar).

### Global / cross-cutting
- 🟠 **Bottom-nav overlap**: multiple screens have content sliding under the
  fixed bottom nav. Standardize a `--content-bottom-pad` and apply everywhere.
- 🟢 **Status-bar safe area**: top content sits close to the system clock on some
  shots; ensure top safe-area padding in the native app.
- 🟢 **Accuracy descriptor words** for quick reading (e.g. 87% = "Great").
- 🟢 **Consistent section cards**: unify radius/padding/border tokens across
  ENGINE panel, report cards, library cards.

---

## 4. Suggested build order (one batch, but staged internally)

1. **Extract** `GameReport.tsx`; add `view: board|report` toggle + the
   "View Game Report →" / "⟵ Board" buttons; wire Android back.
2. **Promotion modal dark fix** (own picker for drag+click).
3. **Eval graph restyle** + make graph & tallies tappable (jump to move; from
   report, jumping returns to board).
4. **Key moments** list on the report.
5. **Import & Library**: empty-space centering, bottom padding, Library result
   consistency, search/sort, delete confirm.
6. **Engine panel fade**, depth-warning toned down, shared bottom padding token.

Each is independently testable; `npm test` + a board/report smoke after each.

---

## 5. Open questions for you (pick before we build)

- **Q1 — Navigation model:** segmented toggle (Board | Report) at the top of the
  Analyse tab, OR a button under the board that opens Report as a pushed page?
  (Button-push feels more Chess.com; toggle is faster to switch.)
- **Q2 — Promotion picker:** our own dark centered picker for everything
  (recommended), or keep react-chessboard's but theme it dark?
- **Q3 — Library result:** show raw `1-0/0-1/½`, or store & show "from your
  perspective" (needs knowing which player is "you")?
- **Q4 — Move list:** keep horizontal strip + add an expandable full 2-column
  list, or replace with a vertical list on the report only?
- **Q5 — Scope:** do ALL of section 3, or just the redesign (sections 1–2) first?
