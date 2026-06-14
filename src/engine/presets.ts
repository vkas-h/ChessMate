export type AnalysisPreset = "quick" | "balanced" | "deep";

export interface PresetConfig {
    label: string;
    description: string;
    depth: number;
    /** per-position cap in ms */
    timeLimit: number;
    useCloud: boolean;
}

export const presets: Record<AnalysisPreset, PresetConfig> = {
    quick: {
        label: "Quick",
        description: "Depth 12 · fastest",
        depth: 12,
        timeLimit: 2000,
        useCloud: true
    },
    balanced: {
        label: "Balanced",
        description: "Depth 16 · recommended",
        depth: 16,
        timeLimit: 5000,
        useCloud: true
    },
    deep: {
        label: "Deep",
        description: "Depth 20 · strictest",
        depth: 20,
        timeLimit: 12000,
        useCloud: true
    }
};

const STORAGE_KEY = "chessmate:preset";

export function loadPreset(): AnalysisPreset {
    const stored = localStorage.getItem(STORAGE_KEY);

    return (stored == "quick" || stored == "balanced" || stored == "deep")
        ? stored : "balanced";
}

export function savePreset(preset: AnalysisPreset) {
    localStorage.setItem(STORAGE_KEY, preset);
}
