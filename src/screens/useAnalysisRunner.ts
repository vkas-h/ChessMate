import { useRef, useState } from "react";

import AnalysedGame from "@/types/game/AnalysedGame";

import { useAppStore } from "../store";
import { analyseGame } from "../engine/analyse";
import { enginePool } from "../engine/enginePool";
import { realtimeAnalyser } from "../engine/realtime";
import { saveGame } from "../lib/library";
import { getToggle } from "../lib/settings";
import {
    AnalysisPreset,
    presets,
    loadPreset,
    savePreset
} from "../engine/presets";

/**
 * Encapsulates the full-game analysis lifecycle (run/cancel, preset,
 * error + depth-warning state, save-with-staleness tracking) so the
 * AnalysisScreen component stays focused on rendering. Extracted as part
 * of breaking up the previously ~940-line screen file.
 */
export function useAnalysisRunner(game: AnalysedGame, treeVersion: number) {
    const {
        analysing, accuracies,
        setAnalysing, setAnalysisProgress, finishAnalysis
    } = useAppStore();

    const [preset, setPresetState] = useState<AnalysisPreset>(loadPreset);
    const [error, setError] = useState<string | null>(null);
    const [depthWarning, setDepthWarning] = useState(false);
    const [saved, setSaved] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const abortRef = useRef<AbortController | null>(null);
    const savedAtVersionRef = useRef<number | null>(null);

    function choosePreset(next: AnalysisPreset) {
        setPresetState(next);
        savePreset(next);
    }

    /** Returns true if the saved copy is now stale (call from an effect). */
    function checkStale(): void {
        if (
            savedAtVersionRef.current != null
            && treeVersion != savedAtVersionRef.current
        ) {
            setSaved(false);
            savedAtVersionRef.current = null;
        }
    }

    async function start() {
        if (analysing) {
            setCancelling(true);
            abortRef.current?.abort();
            enginePool.stop();
            return;
        }

        // Free the shared engine from any realtime search first so the
        // full-game pass isn't fighting it for the worker.
        realtimeAnalyser.cancel();

        setSaved(false);
        setError(null);
        setDepthWarning(false);
        setCancelling(false);
        setAnalysing(true);

        const controller = new AbortController();
        abortRef.current = controller;

        const config = presets[preset];

        try {
            const result = await analyseGame(game, {
                depth: config.depth,
                timeLimit: config.timeLimit,
                useCloud: config.useCloud,
                signal: controller.signal,
                onProgress: progress => setAnalysisProgress(progress)
            });

            setDepthWarning(!result.consistentDepth);
            setCancelling(false);
            finishAnalysis(result.accuracies);

            // Auto-save to the library if the user enabled it, so the
            // game flows into Insights without a manual tap.
            if (getToggle("autoSave")) {
                void saveWith(result.accuracies);
            }
        } catch (err) {
            setAnalysing(false);
            setAnalysisProgress(null);
            setCancelling(false);

            const aborted = controller.signal.aborted
                || (err instanceof Error && err.message == "aborted");

            if (!aborted) {
                const message = err instanceof Error ? err.message : "";
                if (message.includes("timed out")) {
                    setError(
                        "Stockfish took too long on a position. Try the Quick preset or restart the app."
                    );
                } else if (typeof navigator != "undefined" && !navigator.onLine) {
                    setError(
                        "You appear to be offline. Disable cloud analysis or reconnect and try again."
                    );
                } else {
                    setError("Analysis failed. Try the Quick preset or reload the app.");
                }
            }
        } finally {
            if (abortRef.current == controller) abortRef.current = null;
        }
    }

    /** Save with explicit accuracies (used by auto-save right after analysis). */
    async function saveWith(acc?: { white: number; black: number }) {
        setError(null);
        try {
            const id = await saveGame(
                game, acc, useAppStore.getState().libraryId
            );
            useAppStore.getState().setLibraryId(id);
            setSaved(true);
            savedAtVersionRef.current = treeVersion;
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Could not save the game."
            );
        }
    }

    function save() {
        return saveWith(accuracies);
    }

    return {
        preset, choosePreset,
        error, setError,
        depthWarning,
        saved,
        cancelling,
        checkStale,
        start, save
    };
}
