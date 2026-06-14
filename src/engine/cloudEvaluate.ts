import { Chess } from "chess.js";

import { EngineLine } from "@/types/game/position/EngineLine";
import Move from "@/types/game/position/Move";
import EngineVersion from "@/constants/EngineVersion";
import { lichessCastlingMoves } from "@/constants/utils";

/**
 * Fetch a Lichess cloud evaluation for a position. These are very deep
 * (usually depth 30+), so when available they're far more accurate than
 * anything we can compute on-device. Throws if the position isn't in
 * the cloud database or the request fails/times out.
 */
async function getCloudEvaluation(
    fen: string,
    targetCount = 2,
    timeoutMs = 2500
): Promise<EngineLine[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

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

export default getCloudEvaluation;
