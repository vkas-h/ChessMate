import React, { useMemo, useRef, useState, useEffect } from "react";

import {
    StateTreeNode
} from "@/types/game/position/StateTreeNode";
import { getTopEngineLine } from "@/types/game/position/EngineLine";
import { Classification } from "@/constants/Classification";
import PieceColour from "@/constants/PieceColour";

import { useAppStore, getMainlineChain } from "../store";
import { classificationColours } from "../lib/classifications";

const HEIGHT = 110;
const PAD_X = 6;
const PAD_Y = 8;

/** Classifications worth marking with a dot on the graph. */
const dottedClassifications: Classification[] = [
    Classification.BRILLIANT,
    Classification.CRITICAL,
    Classification.MISTAKE,
    Classification.BLUNDER
];

function getWhiteShare(node: StateTreeNode): number {
    const topLine = getTopEngineLine(node.state.engineLines);
    if (!topLine) return 0.5;

    const evaluation = topLine.evaluation;

    if (evaluation.type == "mate") {
        if (evaluation.value > 0) return 1;
        if (evaluation.value < 0) return 0;

        return node.state.moveColour == PieceColour.WHITE ? 1 : 0;
    }

    return 1 / (1 + Math.exp(-0.004 * evaluation.value));
}

/**
 * Whole-game evaluation graph (white advantage area chart) with
 * classification dots; tap or drag to jump to a move. Drawn in true
 * pixel coordinates (measured container width) so nothing distorts.
 */
function EvalGraph() {
    const game = useAppStore(state => state.game);
    const currentNode = useAppStore(state => state.currentNode);
    const goToNode = useAppStore(state => state.goToNode);
    useAppStore(state => state.treeVersion);

    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;

        const observer = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect.width;
            if (w) setWidth(w);
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const mainline = useMemo(
        () => getMainlineChain(game.stateTree),
        [game]
    );

    const shares = useMemo(
        () => mainline.map(getWhiteShare),
        [mainline]
    );

    if (mainline.length < 3) return null;

    const innerW = Math.max(0, width - PAD_X * 2);
    const innerH = HEIGHT - PAD_Y * 2;
    const stepX = innerW / (mainline.length - 1);

    const xAt = (index: number) => PAD_X + index * stepX;
    const yAt = (share: number) => PAD_Y + (1 - share) * innerH;

    // Smooth-ish area path for white advantage
    let path = "";

    if (width > 0) {
        path = `M ${PAD_X} ${HEIGHT - PAD_Y}`;

        shares.forEach((share, index) => {
            path += ` L ${xAt(index).toFixed(1)} ${yAt(share).toFixed(1)}`;
        });

        path += ` L ${(PAD_X + innerW).toFixed(1)} ${HEIGHT - PAD_Y} Z`;
    }

    const currentIndex = mainline.indexOf(currentNode);

    function jumpToEvent(clientX: number) {
        const el = wrapperRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const ratio = (clientX - rect.left - PAD_X)
            / Math.max(1, rect.width - PAD_X * 2);

        const index = Math.round(ratio * (mainline.length - 1));
        const target = mainline[
            Math.max(0, Math.min(index, mainline.length - 1))
        ];

        if (target && target != currentNode) goToNode(target, true);
    }

    return <div
        ref={wrapperRef}
        style={{
            marginTop: 12,
            borderRadius: "var(--r-md)",
            overflow: "hidden",
            background: "var(--surface-1)"
        }}
    >
        {width > 0 && <svg
            width={width}
            height={HEIGHT}
            style={{
                display: "block",
                touchAction: "none",
                cursor: "pointer"
            }}
            onPointerDown={event => {
                event.currentTarget.setPointerCapture(event.pointerId);
                jumpToEvent(event.clientX);
            }}
            onPointerMove={event => {
                if (event.buttons > 0) jumpToEvent(event.clientX);
            }}
        >
            {/* White advantage area */}
            <path d={path} fill="#ecebee" />

            {/* 50% midline */}
            <line
                x1={PAD_X} y1={HEIGHT / 2}
                x2={width - PAD_X} y2={HEIGHT / 2}
                stroke="var(--text-faint)"
                strokeWidth={1}
                strokeDasharray="3 4"
                opacity={0.55}
            />

            {/* Classification dots */}
            {mainline.map((node, index) => {
                const classif = node.state.classification;

                if (
                    !classif
                    || !dottedClassifications.includes(classif)
                ) return null;

                return <circle
                    key={node.id}
                    cx={xAt(index)}
                    cy={yAt(shares[index])}
                    r={4}
                    fill={classificationColours[classif]}
                    stroke="#101014"
                    strokeWidth={1.5}
                />;
            })}

            {/* Current move marker */}
            {currentIndex >= 0 && <>
                <line
                    x1={xAt(currentIndex)} y1={0}
                    x2={xAt(currentIndex)} y2={HEIGHT}
                    stroke="var(--accent)"
                    strokeWidth={1.5}
                    opacity={0.9}
                />
                <circle
                    cx={xAt(currentIndex)}
                    cy={yAt(shares[currentIndex])}
                    r={5}
                    fill="var(--accent)"
                    stroke="#101014"
                    strokeWidth={1.5}
                />
            </>}
        </svg>}
    </div>;
}

export default EvalGraph;
