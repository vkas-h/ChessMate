import React, { useMemo, useState, useEffect } from "react";
import {
    SkipBack, ChevronLeft, ChevronRight, SkipForward,
    FlipVertical2, Play, Pause, Share2, Zap, BarChart3, List
} from "lucide-react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

import PieceColour from "@/constants/PieceColour";
import { Classification } from "@/constants/Classification";
import { getTopEngineLine } from "@/types/game/position/EngineLine";

import { useAppStore } from "../store";
import { countClassifications } from "../engine/analyse";
import { useAnalysisRunner } from "./useAnalysisRunner";
import GameReport from "./GameReport";
import { AnalysisPreset, presets } from "../engine/presets";
import {
    classificationColours,
    classificationIcon,
    classificationNames
} from "../lib/classifications";
import EvalBar from "../components/EvalBar";
import MoveStrip from "../components/MoveStrip";
import EngineLines from "../components/EngineLines";
import ShareDialog from "../components/ShareDialog";
import FullMoveList from "../components/FullMoveList";
import NavButton from "./analysis/NavButton";
import PlayerRow from "./analysis/PlayerRow";
import PromotionDialog from "./analysis/PromotionDialog";
import {
    arrowModeLabels,
    useArrowMode,
    useAutoplay,
    useBestMoveArrow,
    useBoardInteraction,
    useBoardSizing,
    useKeyboardNavigation,
    useRealtimeAnalysis,
    useWarmAnalysisEngine
} from "./analysis/hooks";

function AnalysisScreen() {
    const {
        game, currentNode, treeVersion, flipped, gameLoaded,
        analysing, analysisProgress, analysed, accuracies,
        stepForward, stepBackward, goToStart, goToEnd,
        flipBoard, addMove, bumpTreeVersion
    } = useAppStore();

    const node = currentNode;

    useRealtimeAnalysis(node, analysing, gameLoaded, bumpTreeVersion);
    useWarmAnalysisEngine();

    const { boardAreaRef, boardWidth } = useBoardSizing();

    // Analysis lifecycle (run/cancel/save/preset/errors) lives in a hook.
    const analysis = useAnalysisRunner(game, treeVersion);
    const {
        preset, choosePreset,
        error: analysisError, setError: setAnalysisError,
        depthWarning, saved, cancelling
    } = analysis;

    const shareOpen = useAppStore(state => state.shareOpen);
    const setShareOpen = useAppStore(state => state.setShareOpen);
    const analysisView = useAppStore(state => state.analysisView);
    const setAnalysisView = useAppStore(state => state.setAnalysisView);
    const [fullMoveList, setFullMoveList] = useState(false);
    const { arrowMode, cycleArrowMode } = useArrowMode();
    const { autoplay, setAutoplay } = useAutoplay(node);

    // Revert the "Saved" badge if the tree changed after a save.
    useEffect(() => {
        analysis.checkStale();
    }, [treeVersion]);

    useKeyboardNavigation(stepForward, stepBackward);

    const topLine = getTopEngineLine(node.state.engineLines);
    const evaluation = topLine?.evaluation;

    const { bestAlternative, arrows, exploreBestAlternative } =
        useBestMoveArrow({ node, topLine, arrowMode, treeVersion, addMove });

    const classifCounts = useMemo(
        () => analysed ? countClassifications(game.stateTree) : null,
        [analysed, game.stateTree, treeVersion]
    );

    const {
        promotion,
        setPromotion,
        completePromotion,
        onPieceDrop,
        onPromotionCheck,
        onSquareClick,
        onPieceDragBegin,
        squareStyles,
        badgePosition
    } = useBoardInteraction({ node, boardWidth, flipped, addMove });

    const startAnalysis = analysis.start;
    const onSave = analysis.save;

    const analysisStageLabel = (() => {
        if (!analysing) return "";
        if (cancelling) return "Cancelling…";

        const done = analysisProgress?.done ?? 0;
        const total = analysisProgress?.total ?? 0;
        const count = total > 0 ? ` ${done}/${total}` : "";

        if (analysisProgress?.stage == "preparing") return "Preparing…";
        if (analysisProgress?.stage == "cloud") return `Checking cloud${count}…`;
        if (analysisProgress?.stage == "classifying") return "Classifying moves…";

        return `Analysing${count} · ${Math.round(
            (analysisProgress?.progress || 0) * 100
        )}%`;
    })();

    const whiteName = game.players.white.username || "White";
    const blackName = game.players.black.username || "Black";
    const topName = flipped ? whiteName : blackName;
    const bottomName = flipped ? blackName : whiteName;

    const classification = node.state.classification;

    // Empty state: no game imported yet - show a prompt instead of a
    // ghost board with analyse/save actions that make no sense.
    if (!gameLoaded) {
        return <div style={{
            height: "70vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 32px",
            gap: 8
        }}>
            <div style={{
                width: 64,
                height: 64,
                borderRadius: "var(--r-lg)",
                background: "var(--surface-1)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8
            }}>
                <img
                    src="/logo-knight.png"
                    alt="ChessMate"
                    style={{ width: 38, height: 38, opacity: 0.9 }}
                />
            </div>

            <div style={{ fontWeight: 800, fontSize: 17 }}>
                No game loaded
            </div>

            <div style={{
                color: "var(--text-dim)",
                fontSize: 14,
                lineHeight: 1.5
            }}>
                Import a game from PGN, Chess.com or Lichess
                to start analysing.
            </div>

            <button
                onClick={() => useAppStore.getState().setScreen("home")}
                style={{
                    marginTop: 14,
                    padding: "12px 28px",
                    borderRadius: "var(--r-md)",
                    background: "var(--accent)",
                    color: "var(--accent-text)",
                    fontWeight: 800,
                    fontSize: 14
                }}
            >
                Import a game
            </button>
        </div>;
    }

    // Separate Game Report page (Chess.com-style). Share dialog still
    // renders here so it overlays the report too.
    if (analysisView == "report" && analysed) {
        return <>
            <GameReport onSave={() => void onSave()} saved={saved} />
            {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}
        </>;
    }

    return <div style={{
        // extra bottom padding = height of the fixed nav control bar,
        // so scrolled content is never hidden behind it
        padding: "12px 12px 64px"
    }}>
        {/* Top player */}
        <PlayerRow
            name={topName}
            rating={flipped
                ? game.players.white.rating
                : game.players.black.rating}
            accuracy={analysed
                ? (flipped ? accuracies?.white : accuracies?.black)
                : undefined}
        />

        {/* Board + eval bar */}
        <div
            ref={boardAreaRef}
            style={{
                display: "flex",
                gap: 8,
                alignItems: "stretch",
                margin: "8px 0"
            }}
        >
            <EvalBar
                evaluation={evaluation}
                moveColour={node.state.moveColour}
                flipped={flipped}
            />

            <div style={{
                borderRadius: 10,
                overflow: "hidden",
                position: "relative",
                width: boardWidth
            }}>
                <Chessboard
                    position={node.state.fen}
                    boardOrientation={flipped ? "black" : "white"}
                    onPieceDrop={onPieceDrop as any}
                    onPromotionCheck={onPromotionCheck as any}
                    autoPromoteToQueen={false}
                    onSquareClick={onSquareClick as any}
                    onPieceDragBegin={onPieceDragBegin as any}
                    customSquareStyles={squareStyles}
                    customArrows={arrows as any}
                    customDarkSquareStyle={{ backgroundColor: "var(--board-dark)" }}
                    customLightSquareStyle={{ backgroundColor: "var(--board-light)" }}
                    animationDuration={150}
                    boardWidth={boardWidth}
                />

                {classification && badgePosition && <img
                    src={classificationIcon(classification)}
                    alt={classification}
                    style={{
                        position: "absolute",
                        left: Math.min(
                            Math.max(badgePosition.left, 0),
                            boardWidth - 26
                        ),
                        top: Math.max(badgePosition.top, 0),
                        width: 26,
                        height: 26,
                        filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
                        pointerEvents: "none",
                        zIndex: 5,
                        transition: "left 0.15s, top 0.15s",
                        animation: "badgePop 0.25s var(--ease)"
                    }}
                />}
            </div>
        </div>

        {/* Bottom player */}
        <PlayerRow
            name={bottomName}
            rating={flipped
                ? game.players.black.rating
                : game.players.white.rating}
            accuracy={analysed
                ? (flipped ? accuracies?.black : accuracies?.white)
                : undefined}
        />

        {/* Classification banner */}
        {classification && <div style={{
            marginTop: 10,
            padding: "8px 14px",
            borderRadius: 10,
            background: classificationColours[classification] + "22",
            border: `1px solid ${classificationColours[classification]}55`,
            color: classificationColours[classification],
            fontWeight: 800,
            fontSize: "0.92rem",
            display: "flex",
            alignItems: "center",
            gap: 8
        }}>
            <img
                src={classificationIcon(classification)}
                style={{ width: 20, height: 20 }}
            />
            {node.state.move?.san} is {aOrAn(classification)}{" "}
            {classificationNames[classification].toLowerCase()} move
            {node.state.opening && <span style={{
                marginLeft: "auto",
                color: "var(--text-dim)",
                fontWeight: 500,
                fontSize: "0.78rem",
                textAlign: "right"
            }}>
                {node.state.opening}
            </span>}
        </div>}

        {/* Best alternative ("X was the best move") */}
        {bestAlternative && classification
            && classification != Classification.BEST
            && classification != Classification.BRILLIANT
            && classification != Classification.CRITICAL
            && classification != Classification.FORCED
            && <button
                onClick={exploreBestAlternative}
                style={{
                    width: "100%",
                    marginTop: 6,
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: classificationColours[
                        Classification.BEST] + "1a",
                    border: `1px solid ${classificationColours[
                        Classification.BEST]}44`,
                    color: classificationColours[Classification.BEST],
                    fontWeight: 800,
                    fontSize: "0.92rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer"
                }}
            >
                <img
                    src={classificationIcon(Classification.BEST)}
                    style={{ width: 20, height: 20 }}
                />
                {bestAlternative.san} was the best move
                <span style={{
                    marginLeft: "auto",
                    color: "var(--text-dim)",
                    fontWeight: 500,
                    fontSize: "0.75rem"
                }}>
                    explore ›
                </span>
            </button>}

        {/* Realtime engine lines */}
        <EngineLines />

        {/* Move navigation: horizontal strip + expand-to-full-list */}
        <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <MoveStrip />
            </div>
            <button
                onClick={() => setFullMoveList(true)}
                aria-label="Show all moves"
                title="All moves"
                style={{
                    flexShrink: 0,
                    padding: "8px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-2)",
                    color: "var(--text-dim)",
                    display: "flex",
                    alignItems: "center"
                }}
            >
                <List size={18} />
            </button>
        </div>

        {fullMoveList && <FullMoveList onClose={() => setFullMoveList(false)} />}

        {/* Controls: FIXED above the bottom tab bar so the buttons
            never shift position as content above changes height */}
        <div style={{
            position: "fixed",
            bottom: "calc(var(--nav-height) + env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 560,
            display: "flex",
            gap: 8,
            padding: "8px 12px",
            background: "rgba(14, 14, 15, 0.92)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderTop: "1px solid var(--line)",
            zIndex: 40,
            boxSizing: "border-box"
        }}>
            <NavButton label="Go to start" icon={<SkipBack size={18} />} onClick={() => {
                setAutoplay(false);
                goToStart();
            }} />
            <NavButton label="Previous move" icon={<ChevronLeft size={22} />} onClick={() => {
                setAutoplay(false);
                stepBackward();
            }} grow />
            <NavButton label="Next move" icon={<ChevronRight size={22} />} onClick={() => {
                setAutoplay(false);
                stepForward();
            }} grow />
            <NavButton label="Go to end" icon={<SkipForward size={18} />} onClick={() => {
                setAutoplay(false);
                goToEnd();
            }} />
            <NavButton label="Flip board" icon={<FlipVertical2 size={18} />} onClick={flipBoard} />
        </div>

        {/* Secondary toolbar */}
        <div style={{
            display: "flex",
            gap: 8,
            marginTop: 8
        }}>
            <button
                onClick={() => setAutoplay(!autoplay)}
                aria-label={autoplay ? "Pause autoplay" : "Start autoplay"}
                aria-pressed={autoplay}
                style={{
                    flex: 1,
                    padding: "9px 0",
                    borderRadius: "var(--r-sm)",
                    background: autoplay
                        ? "var(--accent-soft)" : "var(--surface-1)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: autoplay ? "var(--accent)" : "var(--text-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                }}
            >
                {autoplay
                    ? <><Pause size={15} /> Pause</>
                    : <><Play size={15} /> Autoplay</>}
            </button>

            <button
                onClick={cycleArrowMode}
                aria-label={arrowModeLabels[arrowMode]}
                style={{
                    flex: 1.4,
                    padding: "9px 0",
                    borderRadius: "var(--r-sm)",
                    background: arrowMode != "off"
                        ? "var(--accent-soft)" : "var(--surface-1)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: arrowMode != "off"
                        ? "var(--accent)" : "var(--text-dim)"
                }}
            >
                {arrowModeLabels[arrowMode]}
            </button>

            <button
                onClick={() => setShareOpen(true)}
                aria-label="Share or export game"
                style={{
                    flex: 1,
                    padding: "9px 0",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-1)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                }}
            >
                <Share2 size={15} /> Share
            </button>
        </div>

        {/* Analysis strength presets */}
        {!analysing && <div style={{
            display: "flex",
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 4,
            marginTop: 12
        }}>
            {(Object.keys(presets) as AnalysisPreset[]).map(id => {
                const active = preset == id;

                return <button
                    key={id}
                    onClick={() => choosePreset(id)}
                    style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 9,
                        background: active
                            ? "var(--accent-soft)" : "transparent",
                        border: active
                            ? "1px solid var(--accent)"
                            : "1px solid transparent",
                        transition: "background 0.15s"
                    }}
                >
                    <div style={{
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        color: active ? "var(--accent)" : "var(--text)"
                    }}>
                        {presets[id].label}
                    </div>
                    <div style={{
                        fontSize: "0.66rem",
                        color: "var(--text-dim)",
                        marginTop: 1
                    }}>
                        {presets[id].description}
                    </div>
                </button>;
            })}
        </div>}

        {/* Analyse button / progress */}
        <button
            onClick={() => void startAnalysis()}
            style={{
                width: "100%",
                marginTop: 12,
                padding: "15px 0",
                borderRadius: "var(--r-md)",
                background: analysing
                    ? "var(--surface-2)"
                    : analysed ? "var(--surface-1)" : "var(--accent)",
                border: analysed && !analysing
                    ? "1px solid var(--line)" : "none",
                color: analysing || analysed ? "var(--text-dim)" : "var(--accent-text)",
                fontWeight: 800,
                fontSize: "1rem",
                position: "relative",
                overflow: "hidden"
            }}
        >
            {analysing && <div style={{
                position: "absolute",
                inset: 0,
                width: `${(analysisProgress?.progress || 0) * 100}%`,
                background: "rgba(0, 122, 255, 0.25)",
                transition: "width 0.2s"
            }} />}

            <span style={{ position: "relative" }}>
                {analysing
                    ? analysisStageLabel
                    + ((analysisProgress?.cloudHits || 0) > 0
                        ? ` · ☁ ${analysisProgress?.cloudHits}`
                        : "")
                    + ((analysisProgress?.cacheHits || 0) > 0
                        ? ` · ⚡${analysisProgress?.cacheHits}`
                        : "")
                    + (cancelling ? "" : " (tap to cancel)")
                    : analysed
                        ? "Re-analyse game"
                        : <><Zap size={16} style={{
                            verticalAlign: "-3px",
                            marginRight: 6
                        }} />Analyse game</>}
            </span>
        </button>

        {/* View Game Report (the full report lives on its own page) */}
        {analysed && classifCounts && <button
            onClick={() => setAnalysisView("report")}
            style={{
                width: "100%",
                margin: "12px 0 4px",
                padding: "14px 0",
                borderRadius: "var(--r-md)",
                background: "var(--surface-2)",
                border: "1px solid var(--line-strong)",
                color: "var(--text)",
                fontWeight: 800,
                fontSize: "0.95rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
            }}
        >
            <BarChart3 size={17} />
            View Game Report
            {accuracies && !isNaN(accuracies.white) && <span style={{
                color: "var(--text-dim)",
                fontWeight: 700,
                fontSize: "0.82rem"
            }}>
                · {accuracies.white.toFixed(0)}% / {accuracies.black.toFixed(0)}%
            </span>}
            <ChevronRight size={18} />
        </button>}

        {/* Inline error / depth warning */}
        {analysisError && <div
            role="alert"
            style={{
                marginTop: 10,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(201, 50, 48, 0.14)",
                border: "1px solid rgba(201, 50, 48, 0.4)",
                color: "#e08886",
                fontSize: "0.85rem",
                fontWeight: 600
            }}
        >
            {analysisError}
        </div>}

        {analysed && depthWarning && !analysisError && <div style={{
            marginTop: 8,
            color: "var(--text-faint)",
            fontSize: "0.72rem",
            textAlign: "center"
        }}>
            ⓘ Some positions fell short of the target depth — accuracy is
            approximate.
        </div>}

        {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}

        {promotion && <PromotionDialog
            colour={new Chess(node.state.fen).turn()}
            onPick={completePromotion}
            onCancel={() => setPromotion(null)}
        />}

        <div style={{ height: 16 }} />
    </div>;
}

function aOrAn(classification: Classification) {
    return ["excellent", "inaccuracy", "okay"].includes(classification)
        ? "an" : "a";
}

export default AnalysisScreen;
