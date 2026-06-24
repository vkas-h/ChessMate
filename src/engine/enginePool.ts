import EngineVersion from "@/constants/EngineVersion";

import Engine from "./Engine";

/**
 * A single shared Stockfish worker reused by BOTH the full-game
 * analyser and the realtime analyser. Spinning up a WASM worker is
 * expensive (download + compile), so we keep one warm instead of
 * creating a fresh one on every "Analyse" press and a second one for
 * realtime evaluation.
 *
 * MultiPV is tracked so callers can switch between 1 (fast bulk pass)
 * and 2 (engine-lines panel) without redundant setoption spam.
 */
class EnginePool {
    private engine: Engine | null = null;
    private multipv = 0;

    /** Pre-create + UCI-init the engine so the first eval isn't cold. */
    warm(): void {
        this.acquire();
    }

    acquire(multipv = 2): Engine {
        if (!this.engine) {
            this.engine = new Engine(EngineVersion.STOCKFISH_17_LITE);
            this.multipv = 0;
        }

        if (this.multipv != multipv) {
            this.engine.setLineCount(multipv);
            this.multipv = multipv;
        }

        return this.engine;
    }

    /** Abort any in-flight search without destroying the worker. */
    stop(): void {
        this.engine?.stop();
    }

    /** Fully terminate the worker (e.g. on app shutdown). */
    terminate(): void {
        this.engine?.terminate();
        this.engine = null;
        this.multipv = 0;
    }
}

export const enginePool = new EnginePool();
