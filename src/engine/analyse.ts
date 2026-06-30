import { getNodeChain, StateTreeNode } from "@/types/game/position/StateTreeNode";
import { mergeEngineLines } from "@/types/game/position/EngineLine";
import { getGameAnalysis } from "@/lib/reporter/report";
import { getGameAccuracy } from "@/lib/reporter/accuracy";
import AnalysedGame from "@/types/game/AnalysedGame";

import { enginePool } from "./enginePool";
import { getCloudEvaluationsBatch } from "./cloudEvaluate";
import { getStrictGameAccuracy } from "./accuracy";
import {
    hydrateEvalCache,
    getCachedLines,
    putCachedLines,
    normaliseFen
} from "./evalCache";

export interface AnalysisProgress {
    /** 0 to 1 */
    progress: number;
    stage: "preparing" | "cloud" | "evaluating" | "classifying" | "done";
    /** positions evaluated/skipped so far */
    done: number;
    /** total positions in the mainline analysis pass */
    total: number;
    /** how many positions were served by Lichess cloud (deep) evals */
    cloudHits: number;
    /** how many positions were served from the local eval cache */
    cacheHits: number;
}

export interface AnalysisResult {
    accuracies: { white: number; black: number };
    cloudHits: number;
    cacheHits: number;
    /** whether every evaluated position reached the target depth */
    consistentDepth: boolean;
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
 * Pipeline (in order of cost):
 *   1. local eval cache (instant, free)        — evalCache.ts
 *   2. Lichess cloud DB, fetched IN PARALLEL    — cloudEvaluate batch
 *   3. local Stockfish, depth-bounded for a     — enginePool (shared)
 *      consistent depth across the whole game
 *
 * Mutates the state tree.
 */
export async function analyseGame(
    game: AnalysedGame,
    options?: AnalyseOptions
): Promise<AnalysisResult> {
    const {
        depth = 16,
        timeLimit = 5000,
        useCloud = true,
        onProgress,
        signal
    } = options || {};

    await hydrateEvalCache();

    const nodes = getNodeChain(game.stateTree);

    let cloudHits = 0;
    let cacheHits = 0;
    let consistentDepth = true;

    onProgress?.({
        progress: 0,
        stage: "preparing",
        done: 0,
        total: nodes.length,
        cloudHits,
        cacheHits
    });

    // ---- Pass 0: serve from the persistent cache ------------------
    const pending: StateTreeNode[] = [];

    for (const node of nodes) {
        const existingDepth = Math.max(
            0, ...node.state.engineLines.map(line => line.depth)
        );
        if (existingDepth >= depth) continue;

        const cached = getCachedLines(node.state.fen, depth);
        if (cached) {
            mergeEngineLines(node.state.engineLines, cached);
            cacheHits++;
        } else {
            pending.push(node);
        }
    }

    onProgress?.({
        progress: (nodes.length - pending.length) / nodes.length,
        stage: pending.length > 0 && useCloud ? "cloud" : "evaluating",
        done: nodes.length - pending.length,
        total: nodes.length,
        cloudHits,
        cacheHits
    });

    if (signal?.aborted) throw new Error("aborted");

    // ---- Pass 1: PARALLEL cloud prefetch for the misses -----------
    if (useCloud && pending.length > 0) {
        const cloudMap = await getCloudEvaluationsBatch(
            pending.map(node => node.state.fen), 2, 5, signal
        );

        for (let i = pending.length - 1; i >= 0; i--) {
            const node = pending[i];
            const lines = cloudMap.get(normaliseFen(node.state.fen));
            if (lines) {
                mergeEngineLines(node.state.engineLines, lines);
                putCachedLines(node.state.fen, lines);
                cloudHits++;
                pending.splice(i, 1);
            }
        }
    }

    onProgress?.({
        progress: (nodes.length - pending.length) / nodes.length,
        stage: pending.length > 0 ? "evaluating" : "classifying",
        done: nodes.length - pending.length,
        total: nodes.length,
        cloudHits,
        cacheHits
    });

    if (signal?.aborted) throw new Error("aborted");

    // ---- Pass 2: local Stockfish for whatever is still missing ----
    // Bulk pass uses MultiPV 1 (classification only needs the best line
    // + the played move's eval); the engine-lines panel fetches the 2nd
    // line lazily. Depth-bounded so every position reaches `depth`.
    if (pending.length > 0) {
        const engine = enginePool.acquire(1);
        let done = nodes.length - pending.length;

        try {
            for (const node of pending) {
                if (signal?.aborted) throw new Error("aborted");

                engine.setPosition(node.state.fen);

                const lines = await engine.evaluate({
                    depth,
                    timeLimit,
                    mode: "depth"
                });

                mergeEngineLines(node.state.engineLines, lines);
                putCachedLines(node.state.fen, lines);

                if (engine.lastDepthReached < depth) consistentDepth = false;

                done++;
                onProgress?.({
                    progress: done / nodes.length,
                    stage: "evaluating",
                    done,
                    total: nodes.length,
                    cloudHits,
                    cacheHits
                });
            }
        } finally {
            // keep the worker warm for realtime; just stop the search
            enginePool.stop();
        }
    }

    onProgress?.({
        progress: 1,
        stage: "classifying",
        done: nodes.length,
        total: nodes.length,
        cloudHits,
        cacheHits
    });

    // Run the WintrChess reporter (classifications + accuracy)
    getGameAnalysis(game.stateTree);

    // Strict Lichess-style accuracy (volatility-weighted + harmonic
    // mean); falls back to WintrChess's simple average if evals are
    // missing for any position.
    const accuracies = getStrictGameAccuracy(game.stateTree)
        || getGameAccuracy(game.stateTree);

    onProgress?.({
        progress: 1,
        stage: "done",
        done: nodes.length,
        total: nodes.length,
        cloudHits,
        cacheHits
    });

    return { accuracies, cloudHits, cacheHits, consistentDepth };
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
