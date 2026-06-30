/**
 * Tiny zero-dependency test runner. Run with: `npm test`.
 * Kept minimal on purpose (the project had no test setup); covers the
 * pure functions most affected by the recent changes.
 */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
    try {
        fn();
        passed++;
    } catch (error) {
        failed++;
        failures.push(`✗ ${name}\n    ${(error as Error).message}`);
    }
}

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error(msg);
}

function approx(a: number, b: number, eps = 1e-6) {
    assert(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
}

/* ---------------------- winProbability ---------------------- */
import {
    winShareFromCp,
    winPercentFromCp,
    winShareFromEvaluation
} from "../src/core/lib/utils/winProbability";
import PieceColour from "../src/core/constants/PieceColour";

test("winShareFromCp(0) is 0.5", () => {
    approx(winShareFromCp(0), 0.5);
});

test("winShareFromCp is monotonic and bounded", () => {
    assert(winShareFromCp(500) > winShareFromCp(0), "more cp -> higher share");
    assert(winShareFromCp(-500) < 0.5, "negative cp -> below 0.5");
    assert(winShareFromCp(100000) <= 1, "clamped at 1");
    assert(winShareFromCp(-100000) >= 0, "clamped at 0");
});

test("winPercentFromCp(0) is 50", () => {
    approx(winPercentFromCp(0), 50);
});

test("mate resolves to extremes", () => {
    approx(winShareFromEvaluation({ type: "mate", value: 3 }), 1);
    approx(winShareFromEvaluation({ type: "mate", value: -3 }), 0);
});

test("mate 0 uses mover colour", () => {
    approx(
        winShareFromEvaluation({ type: "mate", value: 0 }, PieceColour.WHITE),
        1
    );
    approx(
        winShareFromEvaluation({ type: "mate", value: 0 }, PieceColour.BLACK),
        0
    );
});

test("undefined eval is neutral", () => {
    approx(winShareFromEvaluation(undefined), 0.5);
});

/* ---------------------- evalCache normalise ---------------------- */
import {
    normaliseFen,
    putCachedLines,
    getCachedLines
} from "../src/engine/evalCache";

test("normaliseFen drops move counters", () => {
    const a = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const b = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 12";
    assert(normaliseFen(a) == normaliseFen(b), "same position, diff counters");
});

test("normaliseFen keeps side to move distinct", () => {
    const w = "8/8/8/8/8/8/8/8 w - - 0 1";
    const b = "8/8/8/8/8/8/8/8 b - - 0 1";
    assert(normaliseFen(w) != normaliseFen(b), "side to move matters");
});

/* ---------------------- engine line merge ---------------------- */
import {
    EngineLine,
    mergeEngineLines
} from "../src/core/types/game/position/EngineLine";
import EngineVersion from "../src/core/constants/EngineVersion";

function fakeLine(depth: number, index: number, value: number): EngineLine {
    return {
        depth,
        index,
        source: EngineVersion.STOCKFISH_17_LITE,
        evaluation: { type: "centipawn", value },
        moves: [{ san: "e4", uci: "e2e4" }]
    };
}

test("mergeEngineLines replaces duplicate source/depth/index", () => {
    const lines = [fakeLine(12, 1, 20)];
    mergeEngineLines(lines, [fakeLine(12, 1, 30)]);

    assert(lines.length == 1, `expected 1 line, got ${lines.length}`);
    assert(lines[0].evaluation.value == 30, "duplicate line should be updated");
});

test("mergeEngineLines keeps different multipv lines", () => {
    const lines = [fakeLine(12, 1, 20)];
    mergeEngineLines(lines, [fakeLine(12, 2, 10)]);

    assert(lines.length == 2, `expected 2 lines, got ${lines.length}`);
});

test("eval cache can require a minimum line count", () => {
    const fen = "8/8/8/8/8/8/8/8 w - - 0 1";

    putCachedLines(fen, [fakeLine(14, 1, 10)]);
    assert(getCachedLines(fen, 12, 1), "one line should qualify for minCount 1");
    assert(!getCachedLines(fen, 12, 2), "one line should not qualify for minCount 2");

    putCachedLines(fen, [fakeLine(14, 1, 10), fakeLine(14, 2, 8)]);
    assert(getCachedLines(fen, 12, 2), "two lines should qualify for minCount 2");
});

/* ---------------------- summary / hash dedupe ---------------------- */
import { getGameAccuracy } from "../src/core/lib/reporter/accuracy";

test("reporter accuracy module is importable", () => {
    assert(typeof getGameAccuracy == "function", "getGameAccuracy exists");
});

/* ---------------------- promotion detection ---------------------- */
import { Chess } from "chess.js";

// Mirror of AnalysisScreen.isPromotion — only a LEGAL promoting move
// from->to counts (prevents the dialog on illegal drags / wrong turn).
function isPromotion(fen: string, from: string, to: string): boolean {
    try {
        const board = new Chess(fen);
        return board
            .moves({ square: from as any, verbose: true })
            .some(move => move.to == to && Boolean(move.promotion));
    } catch {
        return false;
    }
}

test("promotion: legal promoting move is detected", () => {
    assert(
        isPromotion("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7", "a8"),
        "white a7->a8 on white's turn is a promotion"
    );
});

test("promotion: NOT my turn -> no promotion dialog", () => {
    assert(
        !isPromotion("4k3/P7/8/8/8/8/8/4K3 b - - 0 1", "a7", "a8"),
        "white pawn cannot promote on black's turn"
    );
});

test("promotion: illegal drag from start square -> false", () => {
    assert(
        !isPromotion(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "e2", "e8"
        ),
        "pawn on e2 can't jump to e8"
    );
});

test("promotion: normal pawn push is not a promotion", () => {
    assert(
        !isPromotion(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "e2", "e4"
        ),
        "e2->e4 is a normal push"
    );
});

test("promotion: capture-promotion is detected", () => {
    assert(
        isPromotion("3r1k2/4P3/8/8/8/8/8/4K3 w - - 0 1", "e7", "d8"),
        "e7xd8 promoting capture"
    );
});

/* ---------------------- report helpers ---------------------- */
import { accuracyDescriptor } from "../src/lib/report";

test("accuracyDescriptor buckets", () => {
    assert(accuracyDescriptor(95).label == "Excellent", "95 -> Excellent");
    assert(accuracyDescriptor(85).label == "Great", "85 -> Great");
    assert(accuracyDescriptor(72).label == "Good", "72 -> Good");
    assert(accuracyDescriptor(62).label == "Okay", "62 -> Okay");
    assert(accuracyDescriptor(40).label == "Poor", "40 -> Poor");
    assert(accuracyDescriptor(NaN).label == "—", "NaN -> dash");
});

/* ---------------------- player stats ---------------------- */
import { computePlayerStats, winRate } from "../src/lib/stats";

const fakeSummaries: any = [
    // user = "me", plays White, wins
    { id: "1", savedAt: "2026-01-01", hash: "a", white: "me", black: "x",
      whiteResult: "win", blackResult: "lose",
      accuracies: { white: 90, black: 70 }, timeControl: "Blitz",
      opening: "Sicilian Defense" },
    // user = "me", plays Black, loses
    { id: "2", savedAt: "2026-01-02", hash: "b", white: "y", black: "me",
      whiteResult: "win", blackResult: "lose",
      accuracies: { white: 80, black: 60 }, timeControl: "Rapid",
      opening: "French Defense" },
    // user = "me", plays Black, wins
    { id: "3", savedAt: "2026-01-03", hash: "c", white: "z", black: "me",
      whiteResult: "lose", blackResult: "win",
      accuracies: { white: 50, black: 88 }, timeControl: "Blitz",
      opening: "Sicilian Defense" },
    // game NOT involving "me" — must be skipped
    { id: "4", savedAt: "2026-01-04", hash: "d", white: "p", black: "q",
      whiteResult: "win", blackResult: "lose" }
];

test("stats: only counts the user's games", () => {
    const s = computePlayerStats(fakeSummaries, "me");
    assert(s.games == 3, `expected 3 games, got ${s.games}`);
});

test("stats: overall W/D/L from user's perspective", () => {
    const s = computePlayerStats(fakeSummaries, "me");
    assert(s.overall.win == 2, `wins ${s.overall.win}`);
    assert(s.overall.loss == 1, `losses ${s.overall.loss}`);
});

test("stats: per-colour split", () => {
    const s = computePlayerStats(fakeSummaries, "me");
    assert(s.asWhite.total == 1 && s.asWhite.win == 1, "white: 1 game, 1 win");
    assert(s.asBlack.total == 2 && s.asBlack.win == 1, "black: 2 games, 1 win");
});

test("stats: accuracy uses the user's own side", () => {
    const s = computePlayerStats(fakeSummaries, "me");
    // white game acc 90, black games acc 60 & 88 -> mean (90+60+88)/3
    approx(s.avgAccuracy, (90 + 60 + 88) / 3, 1e-9);
});

test("stats: openings aggregated", () => {
    const s = computePlayerStats(fakeSummaries, "me");
    const sicilian = s.topOpenings.find(o => o.name == "Sicilian Defense");
    assert(!!sicilian && sicilian.wdl.total == 2, "Sicilian counted twice");
});

test("winRate scores draws as half", () => {
    approx(winRate({ win: 1, draw: 1, loss: 0, total: 2 }), 75);
});

/* ---------------------- update version compare ---------------------- */
import { isNewer } from "../src/lib/updates";

test("isNewer: basic semver", () => {
    assert(isNewer("1.2.0", "1.1.0"), "1.2.0 > 1.1.0");
    assert(isNewer("v2.0.0", "1.9.9"), "2.0.0 > 1.9.9");
    assert(!isNewer("1.1.0", "1.1.0"), "equal is not newer");
    assert(!isNewer("1.0.0", "1.1.0"), "older is not newer");
});

test("isNewer: handles v-prefix and short tags", () => {
    assert(isNewer("v1.2", "1.1.9"), "v1.2 > 1.1.9");
    assert(!isNewer("1.1", "1.1.0"), "1.1 == 1.1.0");
});

/* ----------------------------- report ----------------------------- */
console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
    console.log("\n" + failures.join("\n\n"));
    process.exit(1);
}
