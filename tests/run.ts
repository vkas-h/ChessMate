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
import { normaliseFen } from "../src/engine/evalCache";

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

/* ----------------------------- report ----------------------------- */
console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
    console.log("\n" + failures.join("\n\n"));
    process.exit(1);
}
