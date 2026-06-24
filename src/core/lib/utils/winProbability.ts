import Evaluation from "@/types/game/position/Evaluation";
import PieceColour from "@/constants/PieceColour";

/**
 * Single source of truth for converting an engine evaluation into a
 * white win-probability (0..1). Previously EvalBar, EvalGraph and the
 * accuracy module each used a slightly different sigmoid constant,
 * which made the graph, bar and accuracy numbers visually disagree.
 *
 * We standardise on Lichess's published constant (-0.00368208) so the
 * bar/graph match the accuracy model exactly.
 */
export const WIN_PROB_K = -0.00368208;

/** White win share in [0, 1] from centipawns (White's POV). */
export function winShareFromCp(centipawns: number): number {
    const cp = Math.max(-1000, Math.min(1000, centipawns));
    return 1 / (1 + Math.exp(WIN_PROB_K * cp));
}

/** White win PERCENT in [0, 100] from centipawns. */
export function winPercentFromCp(centipawns: number): number {
    return winShareFromCp(centipawns) * 100;
}

/**
 * White win share in [0, 1] for a full evaluation (handles mate).
 * `mateMover` is the colour that just moved, used to resolve `mate 0`
 * (checkmate already on the board) to the correct winner.
 */
export function winShareFromEvaluation(
    evaluation?: Evaluation,
    mateMover?: PieceColour
): number {
    if (!evaluation) return 0.5;

    if (evaluation.type == "mate") {
        if (evaluation.value > 0) return 1;
        if (evaluation.value < 0) return 0;

        // mate 0: side that played the last move delivered mate
        if (!mateMover) return 0.5;
        return mateMover == PieceColour.WHITE ? 1 : 0;
    }

    return winShareFromCp(evaluation.value);
}
