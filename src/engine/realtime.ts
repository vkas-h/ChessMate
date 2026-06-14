import EngineVersion from "@/constants/EngineVersion";
import { StateTreeNode } from "@/types/game/position/StateTreeNode";
import { getTopEngineLine } from "@/types/game/position/EngineLine";
import { classify } from "@/lib/reporter/classify";
import { getMoveAccuracy } from "@/lib/reporter/accuracy";
import { adaptPieceColour } from "@/constants/PieceColour";
import { Chess } from "chess.js";

import Engine from "./Engine";
import getCloudEvaluation from "./cloudEvaluate";

/** Minimum depth a node must have before we consider it "evaluated". */
const MIN_DEPTH = 12;

/** Engine is shut down after this much idle time (battery saver). */
const IDLE_SHUTDOWN_MS = 30_000;

/**
 * Lazily evaluates positions that have no engine lines yet (e.g. moves
 * the user plays themselves during analysis), then classifies them
 * with the WintrChess reporter so badges appear on sideline moves.
 *
 * The local Stockfish worker is only spun up when actually needed and
 * is terminated again after a period of inactivity.
 */
class RealtimeAnalyser {
    private engine: Engine | null = null;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private currentToken = 0;

    private getEngine() {
        if (!this.engine) {
            this.engine = new Engine(EngineVersion.STOCKFISH_17_LITE);
            this.engine.setLineCount(2);
        }

        return this.engine;
    }

    private touchIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);

        this.idleTimer = setTimeout(() => {
            this.engine?.terminate();
            this.engine = null;
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

            let evaluated = false;

            // Cloud first (deep + free), local engine fallback
            try {
                const cloudLines = await getCloudEvaluation(
                    target.state.fen, 2, 1500
                );

                if (token != this.currentToken) return;

                target.state.engineLines.push(...cloudLines);
                evaluated = true;
            } catch {
                // cloud miss: fall through to local engine
            }

            if (!evaluated) {
                const engine = this.getEngine();
                this.touchIdleTimer();

                engine.setPosition(target.state.fen);

                const lines = await engine.evaluate({
                    depth,
                    timeLimit: 4000
                });

                if (token != this.currentToken) return;

                target.state.engineLines.push(...lines);
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
        this.engine?.stop();
    }

    shutdown() {
        this.cancel();

        if (this.idleTimer) clearTimeout(this.idleTimer);

        this.engine?.terminate();
        this.engine = null;
    }
}

export const realtimeAnalyser = new RealtimeAnalyser();
