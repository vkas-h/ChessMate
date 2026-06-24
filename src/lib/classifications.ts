import { Classification } from "@/constants/Classification";

/* Refreshed to crisp iOS-style hues that harmonise with the new
   blue accent while staying distinguishable + matching the badge
   PNGs. Greens align to the iOS green used for WIN. */
export const classificationColours: Record<Classification, string> = {
    [Classification.BRILLIANT]: "#1ac8c0",
    [Classification.CRITICAL]: "#5aa0e6",
    [Classification.BEST]: "#34c759",
    [Classification.EXCELLENT]: "#34c759",
    [Classification.OKAY]: "#8ab48a",
    [Classification.INACCURACY]: "#ffcc00",
    [Classification.MISTAKE]: "#ff9f0a",
    [Classification.BLUNDER]: "#ff453a",
    [Classification.FORCED]: "#8ab48a",
    [Classification.THEORY]: "#b08968",
    [Classification.RISKY]: "#9b8cff"
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
