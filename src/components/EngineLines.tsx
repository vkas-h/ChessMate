import React, { useState } from "react";
import { Cpu, ChevronDown, Cloud } from "lucide-react";

import {
    StateTreeNode,
    addChildMove
} from "@/types/game/position/StateTreeNode";
import {
    EngineLine,
    pickEngineLines,
    getTopEngineLine
} from "@/types/game/position/EngineLine";
import Evaluation from "@/types/game/position/Evaluation";
import EngineVersion from "@/constants/EngineVersion";

import { useAppStore } from "../store";

function formatEvaluation(evaluation: Evaluation) {
    if (evaluation.type == "mate") {
        if (evaluation.value == 0) return "#";

        return (evaluation.value > 0 ? "+M" : "-M")
            + Math.abs(evaluation.value);
    }

    const pawns = evaluation.value / 100;
    return (pawns >= 0 ? "+" : "") + pawns.toFixed(2);
}

function lineSourceLabel(line: EngineLine) {
    return line.source == EngineVersion.LICHESS_CLOUD
        ? `☁ ${line.depth}`
        : `d${line.depth}`;
}

/**
 * Collapsible panel showing the current top engine lines. Tapping a
 * move walks the board into that line (creating variation nodes).
 */
function EngineLines() {
    const currentNode = useAppStore(state => state.currentNode);
    const goToNode = useAppStore(state => state.goToNode);
    const bumpTreeVersion = useAppStore(state => state.bumpTreeVersion);
    useAppStore(state => state.treeVersion);

    const [open, setOpen] = useState(true);

    const lines = pickEngineLines(
        currentNode.state.fen,
        currentNode.state.engineLines,
        { count: 2 }
    ) || (() => {
        const top = getTopEngineLine(currentNode.state.engineLines);
        return top ? [top] : [];
    })();

    function playLineMoves(line: EngineLine, targetIndex: number) {
        let node: StateTreeNode = currentNode;

        try {
            for (let i = 0; i <= targetIndex; i++) {
                const childCountBefore = node.children.length;
                const next = addChildMove(node, line.moves[i].san);

                // Newly created nodes must stay variations - never
                // extend or hijack the imported mainline.
                if (node.children.length > childCountBefore) {
                    next.mainline = false;
                }

                node = next;
            }
        } catch {
            return;
        }

        bumpTreeVersion();
        goToNode(node);
    }

    return <div style={{
        marginTop: 10,
        background: "var(--surface-1)",
        borderRadius: "var(--r-md)",
        overflow: "hidden"
    }}>
        <button
            onClick={() => setOpen(!open)}
            style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 800,
                color: "var(--text-dim)",
                letterSpacing: "0.02em"
            }}
        >
            <span style={{
                display: "flex",
                alignItems: "center",
                gap: 7
            }}>
                <Cpu size={15} /> ENGINE
            </span>
            <ChevronDown
                size={16}
                style={{
                    transform: open ? "rotate(180deg)" : "none",
                    transition: "transform 0.18s var(--ease)"
                }}
            />
        </button>

        {open && <div style={{ padding: "0 10px 8px" }}>
            {lines.length == 0 && <div style={{
                color: "var(--text-dim)",
                fontSize: "0.8rem",
                padding: "4px 4px 8px"
            }}>
                Evaluating…
            </div>}

            {lines.map(line => {
                const evalText = formatEvaluation(line.evaluation);
                const winning = line.evaluation.value >= 0;

                return <div
                    key={line.source + ":" + line.index}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 2px",
                        overflow: "hidden"
                    }}
                >
                    <span style={{
                        flexShrink: 0,
                        minWidth: 48,
                        textAlign: "center",
                        padding: "2px 5px",
                        borderRadius: 6,
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        background: winning ? "#ecebee" : "var(--surface-3)",
                        color: winning ? "#141318" : "#ecebee",
                        fontFamily: "ui-monospace, monospace"
                    }}>
                        {evalText}
                    </span>

                    <div style={{
                        display: "flex",
                        gap: 2,
                        overflowX: "auto",
                        scrollbarWidth: "none",
                        whiteSpace: "nowrap"
                    }}>
                        {line.moves.slice(0, 10).map((move, index) => (
                            <button
                                key={index}
                                onClick={() => playLineMoves(line, index)}
                                style={{
                                    flexShrink: 0,
                                    padding: "2px 5px",
                                    borderRadius: 5,
                                    fontSize: "0.82rem",
                                    fontWeight: index == 0 ? 800 : 500,
                                    color: index == 0
                                        ? "var(--text)" : "var(--text-dim)"
                                }}
                            >
                                {move.san}
                            </button>
                        ))}
                    </div>

                    <span style={{
                        marginLeft: "auto",
                        flexShrink: 0,
                        fontSize: "0.68rem",
                        color: "var(--text-dim)"
                    }}>
                        {lineSourceLabel(line)}
                    </span>
                </div>;
            })}
        </div>}
    </div>;
}

export default EngineLines;
