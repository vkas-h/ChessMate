import { StateTreeNode, getNodeChain } from "@/types/game/position/StateTreeNode";
import { Classification } from "@/constants/Classification";
import PieceColour from "@/constants/PieceColour";
import { getTopEngineLine } from "@/types/game/position/EngineLine";
import { winShareFromEvaluation } from "@/lib/utils/winProbability";

/** A one-word descriptor + colour for an accuracy %. */
export function accuracyDescriptor(value: number): {
    label: string;
    colour: string;
} {
    if (isNaN(value)) return { label: "—", colour: "var(--text-faint)" };
    if (value >= 90) return { label: "Excellent", colour: "#34c759" };
    if (value >= 80) return { label: "Great", colour: "#34c759" };
    if (value >= 70) return { label: "Good", colour: "#8ab48a" };
    if (value >= 60) return { label: "Okay", colour: "#ffcc00" };
    if (value >= 50) return { label: "Inaccurate", colour: "#ff9f0a" };
    return { label: "Poor", colour: "#ff453a" };
}

/** Classifications that count as "key moments" worth surfacing. */
const KEY_CLASSIFICATIONS: Classification[] = [
    Classification.BRILLIANT,
    Classification.CRITICAL,
    Classification.BLUNDER,
    Classification.MISTAKE
];

export interface KeyMoment {
    node: StateTreeNode;
    ply: number;
    moveNumber: number;
    colour: PieceColour;
    classification: Classification;
    san: string;
    /** White win-share swing magnitude (0..1) caused by this move. */
    swing: number;
}

/**
 * Surface the most important moments of a game (brilliancies, critical
 * moves, mistakes, blunders) so the report can offer "review your
 * blunders" style jump-to navigation. Sorted blunders/mistakes first
 * (by swing), then brilliancies/criticals.
 */
export function getKeyMoments(rootNode: StateTreeNode): KeyMoment[] {
    const nodes = getNodeChain(rootNode);
    const moments: KeyMoment[] = [];

    for (let i = 1; i < nodes.length; i++) {
        const node = nodes[i];
        const classif = node.state.classification;
        const colour = node.state.moveColour;
        const san = node.state.move?.san;

        if (!classif || !colour || !san) continue;
        if (!KEY_CLASSIFICATIONS.includes(classif)) continue;

        const prevShare = winShareFromEvaluation(
            getTopEngineLine(nodes[i - 1].state.engineLines)?.evaluation,
            nodes[i - 1].state.moveColour
        );
        const ownShare = winShareFromEvaluation(
            getTopEngineLine(node.state.engineLines)?.evaluation,
            colour
        );

        moments.push({
            node,
            ply: i,
            moveNumber: Math.ceil(i / 2),
            colour,
            classification: classif,
            san,
            swing: Math.abs(ownShare - prevShare)
        });
    }

    const rank: Record<string, number> = {
        [Classification.BLUNDER]: 0,
        [Classification.MISTAKE]: 1,
        [Classification.CRITICAL]: 2,
        [Classification.BRILLIANT]: 3
    };

    return moments.sort((a, b) => {
        const ra = rank[a.classification] ?? 9;
        const rb = rank[b.classification] ?? 9;
        if (ra != rb) return ra - rb;
        return b.swing - a.swing;
    });
}
