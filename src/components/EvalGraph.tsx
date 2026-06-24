import React, { useMemo, useRef, useState, useEffect } from "react";

import {
    StateTreeNode
} from "@/types/game/position/StateTreeNode";
import { getTopEngineLine } from "@/types/game/position/EngineLine";
import { Classification } from "@/constants/Classification";
import { winShareFromEvaluation } from "@/lib/utils/winProbability";

import { useAppStore, getMainlineChain } from "../store";
import { classificationColours } from "../lib/classifications";

const PAD_X = 0;
const PAD_Y = 6;

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

    // Shared win-probability model (matches EvalBar + accuracy).
    return winShareFromEvaluation(topLine.evaluation, node.state.moveColour);
}

/**
 * Whole-game evaluation graph (white advantage area chart) with
 * classification dots; tap or drag to jump to a move. Now shades white
 * advantage above the midline and black advantage below for instant
 * readability, and (on the report) jumping a move can return to the
 * board via `onJump`.
 */
function EvalGraph(props: {
    height?: number;
    /** Called after navigating to a node (e.g. to return to the board). */
    onJump?: () => void;
}) {
    const HEIGHT = props.height ?? 120;

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
    const midY = PAD_Y + innerH / 2;

    const xAt = (index: number) => PAD_X + index * stepX;
    const yAt = (share: number) => PAD_Y + (1 - share) * innerH;

    // White advantage = area between the curve and the bottom.
    let whitePath = "";
    let linePath = "";

    if (width > 0) {
        whitePath = `M ${PAD_X} ${HEIGHT - PAD_Y}`;
        shares.forEach((share, index) => {
            whitePath += ` L ${xAt(index).toFixed(1)} ${yAt(share).toFixed(1)}`;
        });
        whitePath += ` L ${(PAD_X + innerW).toFixed(1)} ${HEIGHT - PAD_Y} Z`;

        shares.forEach((share, index) => {
            linePath += `${index == 0 ? "M" : "L"} `
                + `${xAt(index).toFixed(1)} ${yAt(share).toFixed(1)} `;
        });
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

        if (target && target != currentNode) {
            goToNode(target, true);
            props.onJump?.();
        }
    }

    return <div
        ref={wrapperRef}
        style={{
            borderRadius: "var(--r-md)",
            overflow: "hidden",
            background: "var(--surface-2)",
            border: "1px solid var(--line)"
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
            {/* Black advantage fills the whole background (below curve
                shows through), white advantage drawn on top. */}
            <rect x={0} y={0} width={width} height={HEIGHT} fill="#0e0e0f" />

            <path d={whitePath} fill="#f5f5f7" />

            {/* outline of the eval line for crispness */}
            <path
                d={linePath}
                fill="none"
                stroke="rgba(0,0,0,0.25)"
                strokeWidth={1}
            />

            {/* 50% midline */}
            <line
                x1={PAD_X} y1={midY}
                x2={width - PAD_X} y2={midY}
                stroke="var(--accent)"
                strokeWidth={1}
                strokeDasharray="3 4"
                opacity={0.5}
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
                    stroke="#0e0e0f"
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
                    stroke="#0e0e0f"
                    strokeWidth={1.5}
                />
            </>}
        </svg>}
    </div>;
}

export default EvalGraph;
