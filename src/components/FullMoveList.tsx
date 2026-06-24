import React from "react";
import { X } from "lucide-react";

import { StateTreeNode } from "@/types/game/position/StateTreeNode";

import { useAppStore, getMainlineChain } from "../store";
import {
    classificationColours,
    classificationIcon
} from "../lib/classifications";

/**
 * Full-game move list as a scrollable 2-column (White | Black) sheet.
 * Addresses the "horizontal strip only shows ~5 moves" complaint — this
 * gives a whole-game overview with classification badges, tap to jump.
 */
function FullMoveList(props: { onClose: () => void }) {
    const game = useAppStore(state => state.game);
    const currentNode = useAppStore(state => state.currentNode);
    const goToNode = useAppStore(state => state.goToNode);
    useAppStore(state => state.treeVersion);

    const mainline = getMainlineChain(game.stateTree).slice(1); // drop root

    // Pair up plies into [white, black] rows.
    const rows: { number: number; white?: StateTreeNode; black?: StateTreeNode }[] = [];
    for (let i = 0; i < mainline.length; i += 2) {
        rows.push({
            number: i / 2 + 1,
            white: mainline[i],
            black: mainline[i + 1]
        });
    }

    function jump(node?: StateTreeNode) {
        if (!node) return;
        goToNode(node);
        props.onClose();
    }

    return <div
        onClick={props.onClose}
        style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 110,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center"
        }}
    >
        <div
            onClick={event => event.stopPropagation()}
            style={{
                width: "100%",
                maxWidth: 560,
                maxHeight: "70vh",
                background: "var(--surface-1)",
                borderRadius: "18px 18px 0 0",
                border: "1px solid var(--line)",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "env(safe-area-inset-bottom)"
            }}
        >
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 16px 10px"
            }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                    All moves
                </h3>
                <button
                    onClick={props.onClose}
                    aria-label="Close move list"
                    style={{ color: "var(--text-faint)", padding: 6, display: "flex" }}
                >
                    <X size={18} />
                </button>
            </div>

            <div style={{ overflowY: "auto", padding: "0 10px 14px" }}>
                {rows.map(row => <div
                    key={row.number}
                    style={{
                        display: "grid",
                        gridTemplateColumns: "32px 1fr 1fr",
                        alignItems: "center",
                        gap: 6,
                        padding: "2px 0"
                    }}
                >
                    <span style={{
                        color: "var(--text-faint)",
                        fontSize: "0.8rem",
                        textAlign: "right",
                        paddingRight: 6
                    }}>
                        {row.number}.
                    </span>
                    <MoveCell node={row.white} current={currentNode} onJump={jump} />
                    <MoveCell node={row.black} current={currentNode} onJump={jump} />
                </div>)}
            </div>
        </div>
    </div>;
}

function MoveCell(props: {
    node?: StateTreeNode;
    current: StateTreeNode;
    onJump: (node?: StateTreeNode) => void;
}) {
    if (!props.node) return <span />;

    const classif = props.node.state.classification;
    const active = props.node == props.current;

    return <button
        onClick={() => props.onJump(props.node)}
        style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 8px",
            borderRadius: 7,
            fontSize: "0.9rem",
            fontWeight: active ? 800 : 600,
            background: active ? "var(--accent-soft)" : "transparent",
            border: active ? "1px solid var(--accent)" : "1px solid transparent",
            color: classif ? classificationColours[classif] : "var(--text)",
            textAlign: "left"
        }}
    >
        {classif && <img
            src={classificationIcon(classif)}
            style={{ width: 13, height: 13 }}
        />}
        {props.node.state.move?.san}
    </button>;
}

export default FullMoveList;
