import { Chess } from "chess.js";

import { EngineLine } from "@/types/game/position/EngineLine";
import Move from "@/types/game/position/Move";
import EngineVersion from "@/constants/EngineVersion";
import { lichessCastlingMoves } from "@/constants/utils";

import { normaliseFen } from "./evalCache";

/**
 * Fetch a Lichess cloud evaluation for a position. These are very deep
 * (usually depth 30+), so when available they're far more accurate than
 * anything we can compute on-device. Throws if the position isn't in
 * the cloud database or the request fails/times out.
 */
async function getCloudEvaluation(
    fen: string,
    targetCount = 2,
    timeoutMs = 2500,
    signal?: AbortSignal
): Promise<EngineLine[]> {
    if (signal?.aborted) throw new Error("aborted");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener("abort", abortFromCaller, { once: true });

    let cloudEvaluation: any;

    try {
        const cloudResponse = await fetch(
            "https://lichess.org/api/cloud-eval"
            + `?fen=${encodeURIComponent(fen)}&multiPv=${targetCount}`,
            { signal: controller.signal }
        );

        if (!cloudResponse.ok) {
            throw new Error(`cloud evaluation failed (${cloudResponse.status})`);
        }

        cloudEvaluation = await cloudResponse.json();
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortFromCaller);
    }

    const engineLines: EngineLine[] = [];

    for (const variation of cloudEvaluation.pvs || []) {
        const variationBoard = new Chess(fen);
        const lineMoves: Move[] = [];

        for (const lichessUciMove of variation.moves.split(" ")) {
            const uciMove = lichessCastlingMoves[lichessUciMove]
                || lichessUciMove;

            try {
                const parsedMove = variationBoard.move(uciMove);

                lineMoves.push({
                    san: parsedMove.san,
                    uci: parsedMove.lan
                });
            } catch {
                break;
            }
        }

        if (lineMoves.length == 0) continue;

        engineLines.push({
            evaluation: {
                type: ("mate" in variation) ? "mate" : "centipawn",
                value: ("mate" in variation) ? variation.mate : variation.cp
            },
            source: EngineVersion.LICHESS_CLOUD,
            depth: cloudEvaluation.depth,
            index: (cloudEvaluation.pvs || []).indexOf(variation) + 1,
            moves: lineMoves
        });
    }

    if (engineLines.length == 0) {
        throw new Error("no usable cloud lines");
    }

    return engineLines;
}

/**
 * Fetch cloud evaluations for many FENs CONCURRENTLY with a bounded
 * worker pool, instead of one-at-a-time. Network round-trips dominate
 * cloud eval time, so doing them in parallel is a big speedup. Returns
 * a map of fen -> lines for every position that was actually in the
 * cloud database (misses are simply absent).
 */
export async function getCloudEvaluationsBatch(
    fens: string[],
    targetCount = 2,
    concurrency = 5,
    signal?: AbortSignal
): Promise<Map<string, EngineLine[]>> {
    const results = new Map<string, EngineLine[]>();

    // De-duplicate transpositions and identical positions whose FENs only
    // differ by halfmove/fullmove counters. Results are keyed by normalized
    // FEN; callers should look up with normaliseFen(fen).
    const representativeByKey = new Map<string, string>();
    for (const fen of fens) {
        representativeByKey.set(normaliseFen(fen), fen);
    }

    const unique = [...representativeByKey.entries()];
    let cursor = 0;

    async function worker() {
        while (cursor < unique.length && !signal?.aborted) {
            const [key, fen] = unique[cursor++];
            try {
                results.set(
                    key,
                    await getCloudEvaluation(fen, targetCount, 2500, signal)
                );
            } catch {
                // miss / failure / abort -> leave absent
                if (signal?.aborted) return;
            }
        }
    }

    await Promise.all(
        Array.from(
            { length: Math.min(concurrency, unique.length) },
            () => worker()
        )
    );

    return results;
}

export default getCloudEvaluation;
