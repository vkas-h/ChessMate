import React from "react";

import Evaluation from "@/types/game/position/Evaluation";
import PieceColour from "@/constants/PieceColour";

function getWhiteShare(
    evaluation?: Evaluation,
    moveColour?: PieceColour
) {
    if (!evaluation) return 0.5;

    if (evaluation.type == "mate") {
        // mate 0: the game ended in checkmate; the side that played
        // the last move is the winner.
        if (evaluation.value == 0) {
            if (!moveColour) return 0.5;
            return moveColour == PieceColour.WHITE ? 1 : 0;
        }

        return evaluation.value > 0 ? 1 : 0;
    }

    // Sigmoid mapping of centipawns to bar share
    return 1 / (1 + Math.exp(-0.004 * evaluation.value));
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
        background: "#3a3a44",
        flexShrink: 0,
        position: "relative"
    }}>
        <div style={{
            flex: 1,
            transition: "all 0.4s ease"
        }} />

        <div style={{
            height: whiteHeight,
            background: "#ecebee",
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
            color: whiteWinning ? "#141318" : "#ecebee"
        }}>
            {label}
        </span>
    </div>;
}

export default EvalBar;
