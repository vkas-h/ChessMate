import EngineVersion from "@/constants/EngineVersion";
import { getNodeChain, StateTreeNode } from "@/types/game/position/StateTreeNode";
import { getGameAnalysis } from "@/lib/reporter/report";
import { getGameAccuracy } from "@/lib/reporter/accuracy";
import AnalysedGame from "@/types/game/AnalysedGame";

import Engine from "./Engine";
import getCloudEvaluation from "./cloudEvaluate";
import { getStrictGameAccuracy } from "./accuracy";

export interface AnalysisProgress {
    /** 0 to 1 */
    progress: number;
    stage: "evaluating" | "classifying" | "done";
    /** how many positions were served by Lichess cloud (deep) evals */
    cloudHits: number;
}

interface AnalyseOptions {
    depth?: number;
    /** ms per position cap, keeps mobile speedy */
    timeLimit?: number;
    /** try Lichess cloud evals (depth 30+) before local engine */
    useCloud?: boolean;
    onProgress?: (progress: AnalysisProgress) => void;
    signal?: AbortSignal;
}

/**
 * Evaluates every mainline position of the game, then runs the
 * WintrChess reporter to classify moves and compute accuracies.
 *
 * For each position we first try the Lichess cloud database (very deep
 * evals, usually depth 30+), and fall back to local Stockfish if the
 * position is unknown or the request fails. Mutates the state tree.
 */
export async function analyseGame(
    game: AnalysedGame,
    options?: AnalyseOptions
) {
    const {
        depth = 16,
        timeLimit = 5000,
        useCloud = true,
        onProgress,
        signal
    } = options || {};

    const nodes = getNodeChain(game.stateTree);

    const engine = new Engine(EngineVersion.STOCKFISH_17_LITE);
    engine.setLineCount(2);

    let cloudHits = 0;
    // Stop hammering the cloud API after repeated misses
    // (positions out of book are rarely in the cloud DB either)
    let cloudMissStreak = 0;
    const CLOUD_MISS_LIMIT = 5;

    try {
        for (let i = 0; i < nodes.length; i++) {
            if (signal?.aborted) throw new Error("aborted");

            const node = nodes[i];

            // Skip if we already have lines at sufficient depth
            const existingDepth = Math.max(
                0, ...node.state.engineLines.map(line => line.depth)
            );

            if (existingDepth < depth) {
                let evaluated = false;

                if (useCloud && cloudMissStreak < CLOUD_MISS_LIMIT) {
                    try {
                        const cloudLines = await getCloudEvaluation(
                            node.state.fen, 2
                        );

                        node.state.engineLines.push(...cloudLines);
                        cloudHits++;
                        cloudMissStreak = 0;
                        evaluated = true;
                    } catch {
                        cloudMissStreak++;
                    }
                }

                if (!evaluated) {
                    engine.setPosition(node.state.fen);

                    const lines = await engine.evaluate({ depth, timeLimit });
                    node.state.engineLines.push(...lines);
                }
            }

            onProgress?.({
                progress: (i + 1) / nodes.length,
                stage: "evaluating",
                cloudHits
            });
        }
    } finally {
        engine.terminate();
    }

    onProgress?.({ progress: 1, stage: "classifying", cloudHits });

    // Run the WintrChess reporter (classifications + accuracy)
    getGameAnalysis(game.stateTree);

    // Strict Lichess-style accuracy (volatility-weighted + harmonic
    // mean); falls back to WintrChess's simple average if evals are
    // missing for any position.
    const accuracies = getStrictGameAccuracy(game.stateTree)
        || getGameAccuracy(game.stateTree);

    onProgress?.({ progress: 1, stage: "done", cloudHits });

    return { accuracies, cloudHits };
}

/** Counts each move classification in the mainline for both colours. */
export function countClassifications(rootNode: StateTreeNode) {
    const counts: Record<string, { white: number; black: number }> = {};

    for (const node of getNodeChain(rootNode)) {
        const classif = node.state.classification;
        const colour = node.state.moveColour;
        if (!classif || !colour) continue;

        counts[classif] ??= { white: 0, black: 0 };
        counts[classif][colour]++;
    }

    return counts;
}
