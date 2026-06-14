import React, { useEffect, useRef } from "react";

import { StateTreeNode } from "@/types/game/position/StateTreeNode";

import { useAppStore, getMainlineChain } from "../store";
import {
    classificationColours,
    classificationIcon
} from "../lib/classifications";

/**
 * WintrChess-style move list:
 *  - the mainline scrolls horizontally as a strip
 *  - variations (user moves played during analysis) appear as
 *    indented rows underneath the move they branch from
 */
function MoveStrip() {
    const currentNode = useAppStore(state => state.currentNode);
    const game = useAppStore(state => state.game);
    // Subscribed so new variation nodes / badges trigger re-render
    useAppStore(state => state.treeVersion);

    const goToNode = useAppStore(state => state.goToNode);

    const activeRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        activeRef.current?.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest"
        });
    }, [currentNode]);

    const mainline = getMainlineChain(game.stateTree);

    // Variation branch points: mainline nodes with extra children
    const variationRows: {
        afterIndex: number;
        firstNode: StateTreeNode;
    }[] = [];

    mainline.forEach((node, index) => {
        for (const child of node.children) {
            const mainChild = mainline[index + 1];

            if (child != mainChild) {
                variationRows.push({
                    afterIndex: index,
                    firstNode: child
                });
            }
        }
    });

    return <div>
        {/* Mainline strip */}
        <div style={{
            display: "flex",
            gap: 4,
            overflowX: "auto",
            padding: "10px 2px 6px",
            scrollbarWidth: "none"
        }}>
            {mainline.map((node, index) => {
                if (index == 0) return null;

                const showNumber = index % 2 == 1;
                const moveNumber = Math.ceil(index / 2);

                return <React.Fragment key={node.id}>
                    {showNumber && <span style={{
                        color: "var(--text-dim)",
                        fontSize: "0.8rem",
                        alignSelf: "center",
                        flexShrink: 0,
                        marginLeft: index > 1 ? 6 : 0
                    }}>
                        {moveNumber}.
                    </span>}

                    <MoveButton
                        node={node}
                        active={node == currentNode}
                        activeRef={node == currentNode
                            ? activeRef : undefined}
                        onClick={() => goToNode(node)}
                    />
                </React.Fragment>;
            })}
        </div>

        {/* Variation rows */}
        {variationRows.map(row => <VariationRow
            key={row.firstNode.id}
            branchMoveIndex={row.afterIndex}
            firstNode={row.firstNode}
            currentNode={currentNode}
            onSelect={goToNode}
        />)}
    </div>;
}

/** Collect a variation line: the branch node + its priority children. */
function getVariationLine(firstNode: StateTreeNode) {
    const line: StateTreeNode[] = [firstNode];

    let current = firstNode.children.at(0);
    while (current) {
        line.push(current);
        current = current.children.at(0);
    }

    return line;
}

function VariationRow(props: {
    branchMoveIndex: number;
    firstNode: StateTreeNode;
    currentNode: StateTreeNode;
    onSelect: (node: StateTreeNode) => void;
}) {
    const line = getVariationLine(props.firstNode);

    // The variation's first move replaces mainline move at index
    // branchMoveIndex + 1 (1-based ply = branchMoveIndex + 1)
    const firstPly = props.branchMoveIndex + 1;
    const moveNumber = Math.ceil(firstPly / 2);
    const isWhiteMove = firstPly % 2 == 1;

    const containsCurrent = line.includes(props.currentNode);

    return <div style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        overflowX: "auto",
        scrollbarWidth: "none",
        margin: "2px 0 2px 14px",
        padding: "4px 8px",
        borderLeft: containsCurrent
            ? "2px solid var(--accent)"
            : "2px solid var(--line)",
        background: containsCurrent
            ? "var(--accent-soft)"
            : "var(--surface-1)",
        borderRadius: "0 9px 9px 0"
    }}>
        <span style={{
            color: "var(--text-dim)",
            fontSize: "0.75rem",
            flexShrink: 0
        }}>
            {moveNumber}.{isWhiteMove ? "" : ".."}
        </span>

        {line.map(node => <MoveButton
            key={node.id}
            node={node}
            small
            active={node == props.currentNode}
            onClick={() => props.onSelect(node)}
        />)}
    </div>;
}

function MoveButton(props: {
    node: StateTreeNode;
    active: boolean;
    small?: boolean;
    activeRef?: React.Ref<HTMLButtonElement>;
    onClick: () => void;
}) {
    const classif = props.node.state.classification;

    return <button
        ref={props.activeRef}
        onClick={props.onClick}
        style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: props.small ? "3px 7px" : "5px 9px",
            borderRadius: 8,
            fontSize: props.small ? "0.8rem" : "0.88rem",
            fontWeight: props.active ? 800 : 600,
            background: props.active
                ? "var(--accent-soft)" : "transparent",
            border: props.active
                ? "1px solid var(--accent)"
                : "1px solid transparent",
            color: classif
                ? classificationColours[classif]
                : "var(--text)"
        }}
    >
        {classif && <img
            src={classificationIcon(classif)}
            style={{
                width: props.small ? 12 : 14,
                height: props.small ? 12 : 14
            }}
        />}
        {props.node.state.move?.san}
    </button>;
}

export default MoveStrip;
