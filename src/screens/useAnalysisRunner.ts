import { useRef, useState } from "react";

import AnalysedGame from "@/types/game/AnalysedGame";

import { useAppStore } from "../store";
import { analyseGame } from "../engine/analyse";
import { realtimeAnalyser } from "../engine/realtime";
import { saveGame } from "../lib/library";
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
            abortRef.current?.abort();
            return;
        }

        // Free the shared engine from any realtime search first so the
        // full-game pass isn't fighting it for the worker.
        realtimeAnalyser.cancel();

        setSaved(false);
        setError(null);
        setDepthWarning(false);
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
            finishAnalysis(result.accuracies);
        } catch (err) {
            setAnalysing(false);
            setAnalysisProgress(null);

            const aborted = controller.signal.aborted
                || (err instanceof Error && err.message == "aborted");

            if (!aborted) {
                setError("Analysis failed. Check your connection and try again.");
            }
        }
    }

    async function save() {
        setError(null);
        try {
            const id = await saveGame(
                game, accuracies, useAppStore.getState().libraryId
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

    return {
        preset, choosePreset,
        error, setError,
        depthWarning,
        saved,
        checkStale,
        start, save
    };
}
