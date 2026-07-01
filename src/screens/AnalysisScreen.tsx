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
import { StateTreeNode } from "@/types/game/position/StateTreeNode";

import { getMainlineChain, getNextChild, useAppStore } from "../store";
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

type SheetTab = "coach" | "lines" | "moves" | "tools";

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
    const [sheetTab, setSheetTab] = useState<SheetTab>("coach");
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

    const mainline = useMemo(
        () => getMainlineChain(game.stateTree),
        [game.stateTree, treeVersion]
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

    const arrowModeShortLabel = arrowMode == "off"
        ? "Arrows off"
        : arrowMode == "continuation" ? "Best now" : "Best instead";

    const whiteName = game.players.white.username || "White";
    const blackName = game.players.black.username || "Black";
    const topName = flipped ? whiteName : blackName;
    const bottomName = flipped ? blackName : whiteName;

    const classification = node.state.classification;
    const atStart = !node.parent;
    const atEnd = !getNextChild(node);
    const moveLabel = currentMoveLabel(node);
    const inVariation = isVariationNode(node, mainline);

    // Empty state: no game imported yet - show a prompt instead of a
    // ghost board with analyse/save actions that make no sense.
    if (!gameLoaded) {
        return <AnalysisEmptyState />;
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
        // Extra bottom padding = fixed move navigation height, so the
        // review sheet is never hidden behind it.
        padding: "10px 12px 24px"
    }}>
        {/* Board-first stage */}
        <section style={boardStageStyle}>
            <PlayerRow
                name={topName}
                rating={flipped
                    ? game.players.white.rating
                    : game.players.black.rating}
                accuracy={analysed
                    ? (flipped ? accuracies?.white : accuracies?.black)
                    : undefined}
            />

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
                    borderRadius: 12,
                    overflow: "hidden",
                    position: "relative",
                    width: boardWidth,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.28)"
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
                        alt={classificationNames[classification]}
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

            <PlayerRow
                name={bottomName}
                rating={flipped
                    ? game.players.black.rating
                    : game.players.white.rating}
                accuracy={analysed
                    ? (flipped ? accuracies?.black : accuracies?.white)
                    : undefined}
            />
        </section>

        <CurrentMoveCard
            node={node}
            moveLabel={moveLabel}
            classification={classification}
            bestMove={bestAlternative?.san}
            topEngineMove={topLine?.moves.at(0)?.san}
            inVariation={inVariation}
            onOpenCoach={() => setSheetTab("coach")}
        />

        {inVariation && <button
            onClick={() => {
                const mainlineNode = mainline.find(
                    item => item.state.fen == node.state.fen
                ) || node.parent || game.stateTree;
                useAppStore.getState().goToNode(mainlineNode, true);
            }}
            style={variationReturnStyle}
        >
            Variation line · return toward game line
        </button>}


        {/* Move navigation belt */}
        <div style={navBeltStyle}>
            <NavButton label="Go to start" icon={<SkipBack size={18} />} disabled={atStart} onClick={() => {
                setAutoplay(false);
                goToStart();
            }} />
            <NavButton label="Previous move" icon={<ChevronLeft size={22} />} disabled={atStart} onClick={() => {
                setAutoplay(false);
                stepBackward();
            }} grow />
            <button
                onClick={() => setSheetTab("moves")}
                aria-label={`Current move: ${moveLabel}. Open moves.`}
                style={{
                    flex: 2.35,
                    minHeight: 44,
                    borderRadius: "var(--r-sm)",
                    background: "var(--accent-soft)",
                    border: "1px solid rgba(0,122,255,0.42)",
                    color: "var(--accent)",
                    fontSize: 12.5,
                    fontWeight: 900,
                    minWidth: 0,
                    padding: "0 8px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                }}
            >
                {moveLabel}
            </button>
            <NavButton label="Next move" icon={<ChevronRight size={22} />} disabled={atEnd} onClick={() => {
                setAutoplay(false);
                stepForward();
            }} grow />
            <NavButton label="Go to end" icon={<SkipForward size={18} />} disabled={atEnd} onClick={() => {
                setAutoplay(false);
                goToEnd();
            }} />
        </div>

        <AnalysisSheet
            activeTab={sheetTab}
            setActiveTab={setSheetTab}
            coach={<CoachTab
                node={node}
                analysed={analysed}
                analysing={analysing}
                cancelling={cancelling}
                analysisProgress={analysisProgress}
                analysisStageLabel={analysisStageLabel}
                classification={classification}
                moveLabel={moveLabel}
                bestAlternative={bestAlternative?.san}
                topLineMove={topLine?.moves.at(0)?.san}
                onShowBest={exploreBestAlternative}
                canShowBest={Boolean(bestAlternative)}
                onStartAnalysis={() => void startAnalysis()}
                onOpenReport={() => setAnalysisView("report")}
                hasReport={analysed && Boolean(classifCounts)}
                accuracies={accuracies}
                analysisError={analysisError}
                depthWarning={depthWarning}
            />}
            lines={<div style={{ paddingTop: 2 }}>
                <EngineLines />
            </div>}
            moves={<MovesTab
                onOpenAllMoves={() => setFullMoveList(true)}
            />}
            tools={<ToolsTab
                autoplay={autoplay}
                setAutoplay={setAutoplay}
                arrowMode={arrowMode}
                arrowLabel={arrowModeShortLabel}
                cycleArrowMode={cycleArrowMode}
                flipBoard={flipBoard}
                setShareOpen={setShareOpen}
                preset={preset}
                choosePreset={choosePreset}
                analysing={analysing}
            />}
        />


        {fullMoveList && <FullMoveList onClose={() => setFullMoveList(false)} />}

        {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}

        {promotion && <PromotionDialog
            colour={new Chess(node.state.fen).turn()}
            onPick={completePromotion}
            onCancel={() => setPromotion(null)}
        />}
    </div>;
}

function AnalysisEmptyState() {
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

function CurrentMoveCard(props: {
    node: StateTreeNode;
    moveLabel: string;
    classification?: Classification;
    bestMove?: string;
    topEngineMove?: string;
    inVariation: boolean;
    onOpenCoach: () => void;
}) {
    const colour = props.classification
        ? classificationColours[props.classification]
        : "var(--accent)";
    const title = props.classification
        ? `${props.moveLabel} · ${classificationNames[props.classification]}`
        : props.node.parent ? props.moveLabel : "Start position";
    const subtitle = props.bestMove
        ? `Best was ${props.bestMove}`
        : props.topEngineMove
            ? `Engine likes ${props.topEngineMove}`
            : props.inVariation ? "Exploring a variation" : "Review the current position";

    return <section style={{
        marginTop: 10,
        background: props.classification
            ? `${colour}16` : "var(--surface-1)",
        border: props.classification
            ? `1px solid ${colour}45` : "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: "11px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10
    }}>
        <div style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: props.classification ? colour : "var(--accent-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: props.classification ? "#111" : "var(--accent)",
            fontWeight: 900
        }}>
            {props.classification
                ? <img
                    src={classificationIcon(props.classification)}
                    alt=""
                    style={{ width: 22, height: 22 }}
                />
                : <Zap size={17} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                fontSize: 14,
                fontWeight: 900,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
            }}>
                {title}
            </div>
            <div style={{
                color: "var(--text-dim)",
                fontSize: 12.5,
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
            }}>
                {subtitle}
            </div>
        </div>
        <button
            onClick={props.onOpenCoach}
            style={{
                flexShrink: 0,
                minHeight: 34,
                padding: "0 12px",
                borderRadius: "var(--r-sm)",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid var(--line)",
                color: "var(--text)",
                fontSize: 12.5,
                fontWeight: 800
            }}
        >
            Coach
        </button>
    </section>;
}

function AnalysisSheet(props: {
    activeTab: SheetTab;
    setActiveTab: (tab: SheetTab) => void;
    coach: React.ReactNode;
    lines: React.ReactNode;
    moves: React.ReactNode;
    tools: React.ReactNode;
}) {
    const tabs: { id: SheetTab; label: string }[] = [
        { id: "coach", label: "Coach" },
        { id: "lines", label: "Lines" },
        { id: "moves", label: "Moves" },
        { id: "tools", label: "Tools" }
    ];

    return <section style={sheetStyle}>
        <div style={sheetHandleStyle} />
        <div role="tablist" aria-label="Analysis panels" style={sheetTabsStyle}>
            {tabs.map(tab => {
                const active = props.activeTab == tab.id;
                return <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => props.setActiveTab(tab.id)}
                    style={{
                        flex: 1,
                        minHeight: 38,
                        borderRadius: "var(--r-sm)",
                        background: active ? "var(--accent-soft)" : "transparent",
                        color: active ? "var(--accent)" : "var(--text-faint)",
                        fontWeight: 900,
                        fontSize: 12.5
                    }}
                >
                    {tab.label}
                </button>;
            })}
        </div>
        <div style={{ padding: "0 12px 12px" }}>
            {props.activeTab == "coach" && props.coach}
            {props.activeTab == "lines" && props.lines}
            {props.activeTab == "moves" && props.moves}
            {props.activeTab == "tools" && props.tools}
        </div>
    </section>;
}

function CoachTab(props: {
    node: StateTreeNode;
    analysed: boolean;
    analysing: boolean;
    cancelling: boolean;
    analysisProgress: { progress: number; done: number; total: number; cloudHits: number; cacheHits: number } | null;
    analysisStageLabel: string;
    classification?: Classification;
    moveLabel: string;
    bestAlternative?: string;
    topLineMove?: string;
    canShowBest: boolean;
    onShowBest: () => void;
    onStartAnalysis: () => void;
    onOpenReport: () => void;
    hasReport: boolean;
    accuracies?: { white: number; black: number };
    analysisError: string | null;
    depthWarning: boolean;
}) {
    const classificationName = props.classification
        ? classificationNames[props.classification]
        : undefined;
    const bestMove = props.bestAlternative || props.topLineMove;

    return <div>
        <div style={coachCardStyle}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6
            }}>
                <Zap size={16} style={{ color: "var(--accent)" }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>
                    {props.node.parent
                        ? classificationName
                            ? `${classificationName} on ${props.moveLabel}`
                            : `Reviewing ${props.moveLabel}`
                        : "Start position"}
                </h3>
            </div>

            <p style={coachTextStyle}>
                {coachText(props.classification, props.bestAlternative, props.topLineMove)}
            </p>

            {bestMove && <div style={{
                marginTop: 10,
                padding: "9px 10px",
                borderRadius: "var(--r-md)",
                background: "var(--surface-3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10
            }}>
                <span style={{
                    color: "var(--text-dim)",
                    fontSize: 12.5,
                    fontWeight: 700
                }}>
                    Best move
                </span>
                <span style={{ fontWeight: 900, color: "var(--text)" }}>
                    {bestMove}
                </span>
            </div>}

            {(props.canShowBest || props.hasReport) && <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {props.canShowBest && <button
                    onClick={props.onShowBest}
                    style={sheetButtonStyle("secondary")}
                >
                    Show best line
                </button>}
                {props.hasReport && <button
                    onClick={props.onOpenReport}
                    style={sheetButtonStyle("primary")}
                >
                    Report
                </button>}
            </div>}
        </div>

        {props.accuracies && <div style={accuracyStripStyle}>
            <div style={accuracyPillStyle}>
                <strong>{props.accuracies.white.toFixed(0)}%</strong>
                <span>White</span>
            </div>
            <div style={accuracyPillStyle}>
                <strong>{props.accuracies.black.toFixed(0)}%</strong>
                <span>Black</span>
            </div>
        </div>}

        <AnalysisAction
            analysed={props.analysed}
            analysing={props.analysing}
            cancelling={props.cancelling}
            progress={props.analysisProgress}
            label={props.analysisStageLabel}
            onStart={props.onStartAnalysis}
        />

        {props.analysisError && <div role="alert" style={errorStyle}>
            {props.analysisError}
        </div>}

        {props.analysed && props.depthWarning && !props.analysisError && <div style={hintStyle}>
            ⓘ Some positions fell short of the target depth — accuracy is approximate.
        </div>}
    </div>;
}

function AnalysisAction(props: {
    analysed: boolean;
    analysing: boolean;
    cancelling: boolean;
    progress: { progress: number; cloudHits: number; cacheHits: number } | null;
    label: string;
    onStart: () => void;
}) {
    return <button
        onClick={props.onStart}
        style={{
            width: "100%",
            marginTop: 10,
            minHeight: 48,
            padding: "13px 0",
            borderRadius: "var(--r-md)",
            background: props.analysing
                ? "var(--surface-2)"
                : props.analysed ? "var(--surface-1)" : "var(--accent)",
            border: props.analysed && !props.analysing
                ? "1px solid var(--line)" : "none",
            color: props.analysing || props.analysed ? "var(--text-dim)" : "var(--accent-text)",
            fontWeight: 900,
            fontSize: 15,
            position: "relative",
            overflow: "hidden"
        }}
    >
        {props.analysing && <div style={{
            position: "absolute",
            inset: 0,
            width: `${(props.progress?.progress || 0) * 100}%`,
            background: "rgba(0, 122, 255, 0.25)",
            transition: "width 0.2s"
        }} />}
        <span style={{ position: "relative" }}>
            {props.analysing
                ? props.label
                + ((props.progress?.cloudHits || 0) > 0
                    ? ` · ☁ ${props.progress?.cloudHits}`
                    : "")
                + ((props.progress?.cacheHits || 0) > 0
                    ? ` · ⚡${props.progress?.cacheHits}`
                    : "")
                + (props.cancelling ? "" : " · tap to cancel")
                : props.analysed ? "Re-analyse game" : "Analyse game"}
        </span>
    </button>;
}

function MovesTab(props: { onOpenAllMoves: () => void }) {
    return <div>
        <MoveStrip />
        <button
            onClick={props.onOpenAllMoves}
            style={{
                width: "100%",
                marginTop: 8,
                minHeight: 42,
                borderRadius: "var(--r-md)",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                color: "var(--text)",
                fontWeight: 850,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
            }}
        >
            <List size={16} /> All moves
        </button>
    </div>;
}

function ToolsTab(props: {
    autoplay: boolean;
    setAutoplay: (value: boolean) => void;
    arrowMode: string;
    arrowLabel: string;
    cycleArrowMode: () => void;
    flipBoard: () => void;
    setShareOpen: (open: boolean) => void;
    preset: AnalysisPreset;
    choosePreset: (preset: AnalysisPreset) => void;
    analysing: boolean;
}) {
    return <div>
        <div style={toolGridStyle}>
            <button
                onClick={() => props.setAutoplay(!props.autoplay)}
                aria-label={props.autoplay ? "Pause autoplay" : "Start autoplay"}
                aria-pressed={props.autoplay}
                style={toolButtonStyle(props.autoplay)}
            >
                {props.autoplay ? <Pause size={15} /> : <Play size={15} />}
                {props.autoplay ? "Pause" : "Autoplay"}
            </button>

            <button
                onClick={props.cycleArrowMode}
                aria-label={arrowModeLabels[props.arrowMode as keyof typeof arrowModeLabels]}
                style={toolButtonStyle(props.arrowMode != "off")}
            >
                {props.arrowLabel}
            </button>

            <button
                onClick={props.flipBoard}
                style={toolButtonStyle(false)}
            >
                <FlipVertical2 size={15} /> Flip
            </button>

            <button
                onClick={() => props.setShareOpen(true)}
                aria-label="Share or export game"
                style={toolButtonStyle(false)}
            >
                <Share2 size={15} /> Share
            </button>
        </div>

        {!props.analysing && <div style={{
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: 8,
            marginTop: 10
        }}>
            <div style={{
                color: "var(--text-dim)",
                fontSize: 12,
                fontWeight: 900,
                margin: "0 2px 7px"
            }}>
                ANALYSIS STRENGTH
            </div>
            <div style={{ display: "flex", gap: 6 }}>
                {(Object.keys(presets) as AnalysisPreset[]).map(id => {
                    const active = props.preset == id;

                    return <button
                        key={id}
                        onClick={() => props.choosePreset(id)}
                        style={{
                            flex: 1,
                            minHeight: 46,
                            padding: "7px 4px",
                            borderRadius: "var(--r-sm)",
                            background: active
                                ? "var(--accent-soft)" : "var(--surface-2)",
                            border: active
                                ? "1px solid var(--accent)"
                                : "1px solid var(--line)",
                            transition: "background 0.15s"
                        }}
                    >
                        <div style={{
                            fontWeight: 900,
                            fontSize: 12.5,
                            color: active ? "var(--accent)" : "var(--text)"
                        }}>
                            {presets[id].label}
                        </div>
                        <div style={{
                            fontSize: 10.5,
                            color: "var(--text-dim)",
                            marginTop: 1
                        }}>
                            {presets[id].description}
                        </div>
                    </button>;
                })}
            </div>
        </div>}
    </div>;
}

function currentMoveLabel(node: StateTreeNode) {
    if (!node.parent || !node.state.move) return "Start";

    let ply = 0;
    let cursor: StateTreeNode | undefined = node;
    while (cursor?.parent) {
        ply++;
        cursor = cursor.parent;
    }

    const moveNumber = Math.ceil(ply / 2);
    const dots = ply % 2 == 1 ? "." : "...";
    return `${moveNumber}${dots} ${node.state.move.san}`;
}

function isVariationNode(node: StateTreeNode, mainline: StateTreeNode[]) {
    return Boolean(node.parent) && !mainline.includes(node);
}

function coachText(
    classification?: Classification,
    bestAlternative?: string,
    topLineMove?: string
) {
    if (classification) {
        const name = classificationNames[classification].toLowerCase();
        if (bestAlternative) {
            return `This was ${aOrAn(classification)} ${name}. The engine preferred ${bestAlternative}; tap Show best line to explore the alternative on the board.`;
        }
        if (topLineMove) {
            return `This was ${aOrAn(classification)} ${name}. The current engine continuation starts with ${topLineMove}.`;
        }
        return `This move was marked as ${aOrAn(classification)} ${name}. Run or deepen analysis for more context.`;
    }

    if (topLineMove) return `The engine's current top continuation starts with ${topLineMove}.`;
    return "Run game analysis to classify moves, calculate accuracy, and unlock the full report.";
}

function aOrAn(classification: Classification) {
    return ["excellent", "inaccuracy", "okay"].includes(classification)
        ? "an" : "a";
}

function sheetButtonStyle(kind: "primary" | "secondary", disabled = false): React.CSSProperties {
    return {
        flex: 1,
        minHeight: 40,
        borderRadius: "var(--r-md)",
        background: kind == "primary" ? "var(--accent)" : "var(--surface-3)",
        color: kind == "primary" ? "var(--accent-text)" : "var(--text)",
        fontWeight: 900,
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? "not-allowed" : "pointer"
    };
}

function toolButtonStyle(active: boolean): React.CSSProperties {
    return {
        minHeight: 44,
        padding: "0 8px",
        borderRadius: "var(--r-md)",
        background: active ? "var(--accent-soft)" : "var(--surface-2)",
        border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
        color: active ? "var(--accent)" : "var(--text-dim)",
        fontWeight: 850,
        fontSize: 12.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6
    };
}

const boardStageStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg)",
    padding: "8px 8px 10px"
};

const navBeltStyle: React.CSSProperties = {
    display: "flex",
    gap: 7,
    marginTop: 10,
    padding: 6,
    background: "rgba(14, 14, 15, 0.58)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg)",
    boxSizing: "border-box"
};

const sheetStyle: React.CSSProperties = {
    marginTop: 10,
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "22px 22px var(--r-lg) var(--r-lg)",
    overflow: "hidden",
    boxShadow: "0 -6px 28px rgba(0,0,0,0.18)"
};

const sheetHandleStyle: React.CSSProperties = {
    width: 46,
    height: 5,
    borderRadius: 99,
    background: "var(--surface-3)",
    margin: "9px auto 8px"
};

const sheetTabsStyle: React.CSSProperties = {
    display: "flex",
    gap: 4,
    padding: "0 10px 10px"
};

const coachCardStyle: React.CSSProperties = {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg)",
    padding: 12
};

const coachTextStyle: React.CSSProperties = {
    margin: 0,
    color: "var(--text-dim)",
    fontSize: 13,
    lineHeight: 1.45
};

const accuracyStripStyle: React.CSSProperties = {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8
};

const accuracyPillStyle: React.CSSProperties = {
    minHeight: 44,
    borderRadius: "var(--r-md)",
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    fontSize: 13
};

const errorStyle: React.CSSProperties = {
    marginTop: 10,
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(201, 50, 48, 0.14)",
    border: "1px solid rgba(201, 50, 48, 0.4)",
    color: "#e08886",
    fontSize: "0.85rem",
    fontWeight: 600
};

const hintStyle: React.CSSProperties = {
    marginTop: 8,
    color: "var(--text-faint)",
    fontSize: "0.76rem",
    textAlign: "center"
};

const variationReturnStyle: React.CSSProperties = {
    width: "100%",
    marginTop: 8,
    minHeight: 36,
    borderRadius: "var(--r-md)",
    background: "var(--accent-soft)",
    border: "1px solid rgba(0,122,255,0.34)",
    color: "var(--accent)",
    fontWeight: 850,
    fontSize: 12.5
};

const toolGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1.15fr 1fr 1fr",
    gap: 8
};

export default AnalysisScreen;
