import { Classification } from "@/constants/Classification";

export const classificationColours: Record<Classification, string> = {
    [Classification.BRILLIANT]: "#1baaa6",
    [Classification.CRITICAL]: "#5b8baf",
    [Classification.BEST]: "#98bc49",
    [Classification.EXCELLENT]: "#98bc49",
    [Classification.OKAY]: "#97af8b",
    [Classification.INACCURACY]: "#f4bf44",
    [Classification.MISTAKE]: "#e28c28",
    [Classification.BLUNDER]: "#c93230",
    [Classification.FORCED]: "#97af8b",
    [Classification.THEORY]: "#a88764",
    [Classification.RISKY]: "#8983ac"
};

export const classificationNames: Record<Classification, string> = {
    [Classification.BRILLIANT]: "Brilliant",
    [Classification.CRITICAL]: "Critical",
    [Classification.BEST]: "Best",
    [Classification.EXCELLENT]: "Excellent",
    [Classification.OKAY]: "Okay",
    [Classification.INACCURACY]: "Inaccuracy",
    [Classification.MISTAKE]: "Mistake",
    [Classification.BLUNDER]: "Blunder",
    [Classification.FORCED]: "Forced",
    [Classification.THEORY]: "Theory",
    [Classification.RISKY]: "Risky"
};

export function classificationIcon(classification: Classification) {
    return `/img/classifications/${classification}.png`;
}

/** Order classifications appear in the report summary. */
export const reportOrder: Classification[] = [
    Classification.BRILLIANT,
    Classification.CRITICAL,
    Classification.BEST,
    Classification.EXCELLENT,
    Classification.OKAY,
    Classification.INACCURACY,
    Classification.MISTAKE,
    Classification.BLUNDER,
    Classification.THEORY,
    Classification.FORCED
];
