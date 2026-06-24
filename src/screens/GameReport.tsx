import React, { useMemo, useState } from "react";
import { ChevronLeft, Save, Check, Share2, Zap } from "lucide-react";

import { Classification } from "@/constants/Classification";
import { getNodeChain } from "@/types/game/position/StateTreeNode";
import PieceColour from "@/constants/PieceColour";

import { useAppStore } from "../store";
import { countClassifications } from "../engine/analyse";
import {
    classificationColours,
    classificationIcon,
    classificationNames,
    reportOrder
} from "../lib/classifications";
import { getKeyMoments } from "../lib/report";
import EvalGraph from "../components/EvalGraph";
import ReportSummary from "../components/ReportSummary";

function GameReport(props: {
    onSave: () => void;
    saved: boolean;
}) {
    const game = useAppStore(state => state.game);
    const accuracies = useAppStore(state => state.accuracies);
    const treeVersion = useAppStore(state => state.treeVersion);
    const setAnalysisView = useAppStore(state => state.setAnalysisView);
    const setShareOpen = useAppStore(state => state.setShareOpen);
    const goToNode = useAppStore(state => state.goToNode);

    const counts = useMemo(
        () => countClassifications(game.stateTree),
        [game, treeVersion]
    );

    const keyMoments = useMemo(
        () => getKeyMoments(game.stateTree).slice(0, 8),
        [game, treeVersion]
    );

    // The game's opening = deepest opening name on the mainline.
    const opening = useMemo(() => {
        let name: string | undefined;
        for (const node of getNodeChain(game.stateTree)) {
            if (node.state.opening) name = node.state.opening;
        }
        return name;
    }, [game, treeVersion]);

    function backToBoard() {
        setAnalysisView("board");
    }

    /** Navigate to a node and return to the board to view it. */
    function jumpTo(node: Parameters<typeof goToNode>[0]) {
        goToNode(node, true);
        backToBoard();
    }

    function jumpToClassification(classif: Classification) {
        const target = getNodeChain(game.stateTree).find(
            node => node.state.classification == classif
        );
        if (target) jumpTo(target);
    }

    const whiteName = game.players.white.username || "White";
    const blackName = game.players.black.username || "Black";

    return <div style={{ padding: "12px 12px 32px" }}>
        {/* Header bar */}
        <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14
        }}>
            <button
                onClick={backToBoard}
                aria-label="Back to board"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "8px 12px 8px 8px",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-1)",
                    border: "1px solid var(--line)",
                    color: "var(--text)",
                    fontWeight: 700,
                    fontSize: 13
                }}
            >
                <ChevronLeft size={18} /> Board
            </button>

            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                color: "var(--accent)",
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: "0.02em"
            }}>
                <Zap size={15} /> GAME REPORT
            </div>
        </div>

        {/* Players + opening */}
        <div style={{
            background: "var(--surface-1)",
            borderRadius: "var(--r-lg)",
            padding: "14px 16px",
            marginBottom: 12
        }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
                {whiteName}
                {game.players.white.rating
                    && <span style={{
                        color: "var(--text-dim)", fontWeight: 600, fontSize: 13
                    }}> ({game.players.white.rating})</span>}
                <span style={{
                    color: "var(--text-faint)", fontWeight: 600
                }}> vs </span>
                {blackName}
                {game.players.black.rating
                    && <span style={{
                        color: "var(--text-dim)", fontWeight: 600, fontSize: 13
                    }}> ({game.players.black.rating})</span>}
            </div>

            {(opening || game.timeControl) && <div style={{
                color: "var(--text-dim)",
                fontSize: 12.5,
                marginTop: 4
            }}>
                {opening}
                {opening && game.timeControl && " · "}
                {game.timeControl}
            </div>}
        </div>

        {/* Eval graph */}
        <div style={{ marginBottom: 12 }}>
            <EvalGraph height={130} onJump={backToBoard} />
            <div style={{
                fontSize: 11,
                color: "var(--text-faint)",
                textAlign: "center",
                marginTop: 6
            }}>
                Tap the graph to jump to a move
            </div>
        </div>

        {/* Accuracy + move quality (tappable rows) */}
        <ReportSummary
            accuracies={accuracies}
            counts={counts}
            order={reportOrder}
            onJumpToClassification={jumpToClassification}
        />

        {/* Key moments */}
        {keyMoments.length > 0 && <div style={{
            marginTop: 12,
            background: "var(--surface-1)",
            borderRadius: "var(--r-lg)",
            padding: "14px 14px 8px"
        }}>
            <h3 style={{
                margin: "0 0 10px",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.04em",
                color: "var(--text-dim)"
            }}>
                KEY MOMENTS
            </h3>

            {keyMoments.map(moment => {
                const colour = classificationColours[moment.classification];
                const side = moment.colour == PieceColour.WHITE
                    ? "White" : "Black";
                const dots = moment.colour == PieceColour.WHITE ? "." : "..";

                return <button
                    key={moment.node.id}
                    onClick={() => jumpTo(moment.node)}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 10px",
                        marginBottom: 6,
                        borderRadius: "var(--r-md)",
                        background: colour + "14",
                        border: `1px solid ${colour}33`,
                        cursor: "pointer",
                        textAlign: "left"
                    }}
                >
                    <img
                        src={classificationIcon(moment.classification)}
                        style={{ width: 20, height: 20, flexShrink: 0 }}
                    />
                    <span style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: colour,
                        minWidth: 0,
                        flex: 1
                    }}>
                        {moment.moveNumber}{dots} {moment.san}
                        <span style={{
                            color: "var(--text-dim)",
                            fontWeight: 600,
                            fontSize: 12
                        }}>
                            {" "}— {side} {classificationNames[
                                moment.classification
                            ].toLowerCase()}
                        </span>
                    </span>
                    <span style={{
                        color: "var(--text-faint)",
                        fontSize: 12,
                        fontWeight: 600,
                        flexShrink: 0
                    }}>
                        view ›
                    </span>
                </button>;
            })}
        </div>}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
                onClick={props.onSave}
                disabled={props.saved}
                style={{
                    flex: 2,
                    padding: "13px 0",
                    borderRadius: "var(--r-md)",
                    background: props.saved
                        ? "var(--surface-1)" : "var(--surface-2)",
                    border: "1px solid var(--line)",
                    color: props.saved ? "var(--good)" : "var(--text)",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                }}
            >
                {props.saved
                    ? <><Check size={16} /> Saved to library</>
                    : <><Save size={16} /> Save to library</>}
            </button>

            <button
                onClick={() => setShareOpen(true)}
                aria-label="Share or export game"
                style={{
                    flex: 1,
                    padding: "13px 0",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-1)",
                    border: "1px solid var(--line)",
                    color: "var(--text)",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                }}
            >
                <Share2 size={15} /> Share
            </button>
        </div>
    </div>;
}

export default GameReport;
