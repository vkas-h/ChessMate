import {
    StateTreeNode,
    getNodeChain
} from "@/types/game/position/StateTreeNode";
import { getTopEngineLine } from "@/types/game/position/EngineLine";
import PieceColour from "@/constants/PieceColour";

/**
 * Strict game accuracy — a faithful reimplementation of Lichess's
 * published gameAccuracy algorithm (lila AccuracyPercent.scala):
 *
 *   - Win% from centipawns: 50 + 50 * (2 / (1 + e^(-0.00368208cp)) - 1)
 *   - Move accuracy: 103.1668 * e^(-0.04354 * winDiff) - 3.1669
 *   - Game accuracy: mean of a volatility-weighted mean and a
 *     HARMONIC mean of move accuracies.
 *
 * The harmonic mean punishes blunders heavily (one terrible move
 * drags the whole score down), which is what makes this far stricter
 * than a simple average.
 */

function winPercentFromNode(node: StateTreeNode): number | undefined {
    const topLine = getTopEngineLine(node.state.engineLines);
    if (!topLine) return undefined;

    const evaluation = topLine.evaluation;

    if (evaluation.type == "mate") {
        if (evaluation.value > 0) return 100;
        if (evaluation.value < 0) return 0;

        // mate 0: side that played the last move delivered mate
        return node.state.moveColour == PieceColour.WHITE ? 100 : 0;
    }

    // Lichess WinPercent.fromCentiPawns
    const cp = Math.max(-1000, Math.min(1000, evaluation.value));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function moveAccuracy(winDiff: number) {
    // Lichess AccuracyPercent.fromWinPercents
    const raw = 103.1668 * Math.exp(-0.04354 * winDiff) - 3.1669 + 1;
    return Math.max(0, Math.min(100, raw));
}

function standardDeviation(values: number[]) {
    if (values.length == 0) return 0;

    const mean = values.reduce((total, x) => total + x, 0) / values.length;

    const variance = values.reduce(
        (total, x) => total + (x - mean) ** 2, 0
    ) / values.length;

    return Math.sqrt(variance);
}

function weightedMean(values: number[], weights: number[]) {
    let total = 0;
    let weightTotal = 0;

    for (let i = 0; i < values.length; i++) {
        total += values[i] * weights[i];
        weightTotal += weights[i];
    }

    return weightTotal > 0 ? total / weightTotal : undefined;
}

function harmonicMean(values: number[]) {
    if (values.length == 0) return undefined;

    let reciprocalSum = 0;

    for (const value of values) {
        reciprocalSum += 1 / Math.max(value, 1);
    }

    return values.length / reciprocalSum;
}

export function getStrictGameAccuracy(
    rootNode: StateTreeNode
): { white: number; black: number } | undefined {
    const nodes = getNodeChain(rootNode);
    if (nodes.length < 3) return undefined;

    // Win% (White's POV) for every position incl. the root
    const winPercents: number[] = [];

    for (const node of nodes) {
        const winPercent = winPercentFromNode(node);

        // A gap in evals would misalign everything; bail out of strict
        // mode and let the caller fall back.
        if (winPercent == undefined) return undefined;

        winPercents.push(winPercent);
    }

    const moveCount = winPercents.length - 1;

    // Lichess: windowSize = clamp(numMoves / 10, 2, 8)
    const windowSize = Math.max(2, Math.min(8, Math.floor(moveCount / 10)));

    // Build sliding windows over the win% sequence; pad the start with
    // copies of the first window so there's one weight per move.
    const windows: number[][] = [];

    const firstWindow = winPercents.slice(
        0, Math.min(windowSize, winPercents.length)
    );

    const padCount = Math.max(
        0, Math.min(windowSize, winPercents.length) - 2
    );

    for (let i = 0; i < padCount; i++) windows.push(firstWindow);

    if (winPercents.length <= windowSize) {
        windows.push(winPercents.slice());
    } else {
        for (let i = 0; i + windowSize <= winPercents.length; i++) {
            windows.push(winPercents.slice(i, i + windowSize));
        }
    }

    // Volatility weight per move: clamp(stddev(window), 0.5, 12)
    const weights = windows.map(window =>
        Math.max(0.5, Math.min(12, standardDeviation(window)))
    );

    // Per-move accuracies, attributed to the mover's colour
    const accuracies: Record<PieceColour, number[]> = {
        [PieceColour.WHITE]: [],
        [PieceColour.BLACK]: []
    };

    const moveWeights: Record<PieceColour, number[]> = {
        [PieceColour.WHITE]: [],
        [PieceColour.BLACK]: []
    };

    for (let i = 0; i < moveCount; i++) {
        const colour = nodes[i + 1].state.moveColour;
        if (!colour) continue;

        const prev = winPercents[i];
        const next = winPercents[i + 1];

        // Win difference from the mover's perspective
        const winDiff = colour == PieceColour.WHITE
            ? prev - next
            : next - prev;

        accuracies[colour].push(moveAccuracy(winDiff));
        moveWeights[colour].push(weights[Math.min(i, weights.length - 1)]);
    }

    function colourAccuracy(colour: PieceColour) {
        const values = accuracies[colour];
        if (values.length == 0) return NaN;

        const weighted = weightedMean(values, moveWeights[colour]);
        const harmonic = harmonicMean(values);

        if (weighted == undefined || harmonic == undefined) return NaN;

        return (weighted + harmonic) / 2;
    }

    return {
        white: colourAccuracy(PieceColour.WHITE),
        black: colourAccuracy(PieceColour.BLACK)
    };
}
