import React from "react";

import Evaluation from "@/types/game/position/Evaluation";
import PieceColour from "@/constants/PieceColour";
import { winShareFromEvaluation } from "@/lib/utils/winProbability";

function getWhiteShare(
    evaluation?: Evaluation,
    moveColour?: PieceColour
) {
    // Shared win-probability model so the bar, graph and accuracy
    // numbers all agree.
    return winShareFromEvaluation(evaluation, moveColour);
}

function formatEvaluation(evaluation?: Evaluation) {
    if (!evaluation) return "0.0";

    if (evaluation.type == "mate") {
        return evaluation.value == 0
            ? "#" : "M" + Math.abs(evaluation.value);
    }

    return Math.abs(evaluation.value / 100).toFixed(1);
}

function EvalBar(props: {
    evaluation?: Evaluation;
    moveColour?: PieceColour;
    flipped?: boolean;
}) {
    const whiteShare = getWhiteShare(props.evaluation, props.moveColour);
    const whiteOnBottom = !props.flipped;

    const whiteHeight = `${whiteShare * 100}%`;

    const whiteWinning = whiteShare >= 0.5;
    const label = formatEvaluation(props.evaluation);

    return <div style={{
        width: 26,
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: whiteOnBottom ? "column" : "column-reverse",
        background: "#2f2f31",
        flexShrink: 0,
        position: "relative"
    }}>
        <div style={{
            flex: 1,
            transition: "all 0.4s ease"
        }} />

        <div style={{
            height: whiteHeight,
            background: "#f5f5f7",
            transition: "height 0.4s ease"
        }} />

        <span style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: "0.58rem",
            fontWeight: 800,
            ...(whiteWinning == whiteOnBottom
                ? { bottom: 4 } : { top: 4 }),
            color: whiteWinning ? "#1a1a1b" : "#f5f5f7"
        }}>
            {label}
        </span>
    </div>;
}

export default EvalBar;
