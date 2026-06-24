import { StateTreeNode } from "@/types/game/position/StateTreeNode";
import { getTopEngineLine } from "@/types/game/position/EngineLine";
import { classify } from "@/lib/reporter/classify";
import { getMoveAccuracy } from "@/lib/reporter/accuracy";
import { adaptPieceColour } from "@/constants/PieceColour";
import { Chess } from "chess.js";

import { enginePool } from "./enginePool";
import getCloudEvaluation from "./cloudEvaluate";
import { getCachedLines, putCachedLines } from "./evalCache";

/** Minimum depth a node must have before we consider it "evaluated". */
const MIN_DEPTH = 12;

/** Engine is shut down after this much idle time (battery saver). */
const IDLE_SHUTDOWN_MS = 30_000;

/**
 * Lazily evaluates positions that have no engine lines yet (e.g. moves
 * the user plays themselves during analysis), then classifies them
 * with the WintrChess reporter so badges appear on sideline moves.
 *
 * Uses the SHARED engine pool (so it doesn't fight with full-game
 * analysis over a second WASM worker) and the persistent eval cache.
 * The shared worker is terminated after a period of inactivity to save
 * battery.
 */
class RealtimeAnalyser {
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private currentToken = 0;

    private touchIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);

        this.idleTimer = setTimeout(() => {
            enginePool.terminate();
        }, IDLE_SHUTDOWN_MS);
    }

    /** Whether a node still needs evaluating. */
    needsEvaluation(node: StateTreeNode) {
        const topLine = getTopEngineLine(node.state.engineLines);
        return !topLine || topLine.depth < MIN_DEPTH;
    }

    /**
     * Ensure a node (and enough of its context) is evaluated, then
     * classify it. Calls onUpdate as data arrives so the UI can
     * refresh. Stale requests (user moved on) are dropped.
     */
    async analyseNode(
        node: StateTreeNode,
        options: {
            depth?: number;
            onUpdate: () => void;
        }
    ) {
        const token = ++this.currentToken;
        const depth = options.depth || 14;

        // The parent must be evaluated too, for classification
        const targets: StateTreeNode[] = [];

        if (node.parent && this.needsEvaluation(node.parent)) {
            targets.push(node.parent);
        }

        if (this.needsEvaluation(node)) targets.push(node);

        for (const target of targets) {
            if (token != this.currentToken) return;

            // 1. local cache (instant)
            const cached = getCachedLines(target.state.fen, MIN_DEPTH);
            if (cached) {
                target.state.engineLines.push(...cached);
                options.onUpdate();
                continue;
            }

            let evaluated = false;

            // 2. cloud (deep + free)
            try {
                const cloudLines = await getCloudEvaluation(
                    target.state.fen, 2, 1500
                );

                if (token != this.currentToken) return;

                target.state.engineLines.push(...cloudLines);
                putCachedLines(target.state.fen, cloudLines);
                evaluated = true;
            } catch {
                // cloud miss: fall through to local engine
            }

            // 3. local engine (shared pool, 2 lines for the panel)
            if (!evaluated) {
                const engine = enginePool.acquire(2);
                this.touchIdleTimer();

                engine.setPosition(target.state.fen);

                const lines = await engine.evaluate({
                    depth,
                    timeLimit: 4000,
                    mode: "depth"
                });

                if (token != this.currentToken) return;

                target.state.engineLines.push(...lines);
                putCachedLines(target.state.fen, lines);
            }

            options.onUpdate();
        }

        // Classify + accuracy once evals exist (mirrors report.ts)
        if (node.parent && node.state.move) {
            try {
                node.state.classification = classify(node);
            } catch {
                node.state.classification = undefined;
            }

            try {
                const parentTop = getTopEngineLine(
                    node.parent.state.engineLines
                );
                const ownTop = getTopEngineLine(node.state.engineLines);

                if (parentTop && ownTop) {
                    const move = new Chess(node.parent.state.fen)
                        .move(node.state.move.san);

                    node.state.accuracy = getMoveAccuracy(
                        parentTop.evaluation,
                        ownTop.evaluation,
                        adaptPieceColour(move.color)
                    );
                }
            } catch {
                // accuracy is best-effort
            }

            options.onUpdate();
        }

        this.touchIdleTimer();
    }

    /** Drop any in-flight work (user navigated away). */
    cancel() {
        this.currentToken++;
        enginePool.stop();
    }

    shutdown() {
        this.cancel();

        if (this.idleTimer) clearTimeout(this.idleTimer);

        enginePool.terminate();
    }
}

export const realtimeAnalyser = new RealtimeAnalyser();
