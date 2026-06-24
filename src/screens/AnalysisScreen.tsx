import React, { useMemo, useRef, useState, useEffect } from "react";
import {
    SkipBack, ChevronLeft, ChevronRight, SkipForward,
    FlipVertical2, Play, Pause, Share2, Zap, BarChart3, List
} from "lucide-react";
import { Chessboard } from "react-chessboard";
import { Chess, Move } from "chess.js";

import PieceColour from "@/constants/PieceColour";
import { Classification } from "@/constants/Classification";
import { getTopEngineLine } from "@/types/game/position/EngineLine";

import { useAppStore } from "../store";
import { countClassifications } from "../engine/analyse";
import { realtimeAnalyser } from "../engine/realtime";
import { enginePool } from "../engine/enginePool";
import { hydrateEvalCache } from "../engine/evalCache";
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

type ArrowMode = "off" | "continuation" | "alternative";

const arrowModeLabels: Record<ArrowMode, string> = {
    off: "Arrow: off",
    continuation: "Arrow: best now",
    alternative: "Arrow: best instead"
};

const ARROW_STORAGE_KEY = "chessmate:arrowMode";

function AnalysisScreen() {
    const {
        game, currentNode, treeVersion, flipped, gameLoaded,
        analysing, analysisProgress, analysed, accuracies,
        stepForward, stepBackward, goToStart, goToEnd,
        flipBoard, addMove, bumpTreeVersion
    } = useAppStore();

    const node = currentNode;

    // Realtime analysis: when landing on a position with no evals
    // (e.g. a move the user just played), evaluate + classify it in
    // the background so the eval bar and badge come alive.
    useEffect(() => {
        if (analysing || !gameLoaded) return;

        if (
            realtimeAnalyser.needsEvaluation(node)
            || (node.state.move && !node.state.classification
                && node.parent)
        ) {
            void realtimeAnalyser.analyseNode(node, {
                onUpdate: bumpTreeVersion
            });
        }

        return () => realtimeAnalyser.cancel();
    }, [node, analysing, gameLoaded, bumpTreeVersion]);

    const [boardWidth, setBoardWidth] = useState(360);
    const [promotion, setPromotion] = useState<
        { from: string; to: string } | null
    >(null);

    // Analysis lifecycle (run/cancel/save/preset/errors) lives in a hook.
    const analysis = useAnalysisRunner(game, treeVersion);
    const {
        preset, choosePreset,
        error: analysisError, setError: setAnalysisError,
        depthWarning, saved
    } = analysis;

    const shareOpen = useAppStore(state => state.shareOpen);
    const setShareOpen = useAppStore(state => state.setShareOpen);
    const analysisView = useAppStore(state => state.analysisView);
    const setAnalysisView = useAppStore(state => state.setAnalysisView);
    const [fullMoveList, setFullMoveList] = useState(false);
    const [autoplay, setAutoplay] = useState(false);

    const [arrowMode, setArrowMode] = useState<ArrowMode>(() => {
        const stored = localStorage.getItem(ARROW_STORAGE_KEY);

        return (
            stored == "off"
            || stored == "continuation"
            || stored == "alternative"
        ) ? stored : "alternative";
    });

    function cycleArrowMode() {
        const order: ArrowMode[] = ["alternative", "continuation", "off"];
        const next = order[(order.indexOf(arrowMode) + 1) % order.length];

        setArrowMode(next);
        localStorage.setItem(ARROW_STORAGE_KEY, next);
    }

    const boardAreaRef = useRef<HTMLDivElement | null>(null);

    // Revert the "Saved" badge if the tree changed after a save.
    useEffect(() => {
        analysis.checkStale();
    }, [treeVersion]);

    // Warm the shared engine + eval cache as soon as the analysis
    // screen is open, so the first evaluation isn't a cold WASM start.
    useEffect(() => {
        void hydrateEvalCache();
        enginePool.warm();
    }, []);

    useEffect(() => {
        function updateWidth() {
            const el = boardAreaRef.current;
            if (!el) return;
            setBoardWidth(Math.min(el.clientWidth - 34, 520));
        }

        updateWidth();
        window.addEventListener("resize", updateWidth);
        return () => window.removeEventListener("resize", updateWidth);
    }, []);

    // Swipe + key navigation
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key == "ArrowRight") stepForward();
            if (event.key == "ArrowLeft") stepBackward();
        }

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [stepForward, stepBackward]);

    // Set true for the single node-change that autoplay itself causes,
    // so the cancel-on-manual-navigation effect can tell them apart.
    const autoplayStepRef = useRef(false);

    // Autoplay: step forward every 1.2s until the line ends
    useEffect(() => {
        if (!autoplay) return;

        const interval = setInterval(() => {
            const state = useAppStore.getState();
            const before = state.currentNode;

            autoplayStepRef.current = true;
            state.stepForward();

            // Reached the end of the line: stop
            if (useAppStore.getState().currentNode == before) {
                autoplayStepRef.current = false;
                setAutoplay(false);
            }
        }, 1200);

        return () => clearInterval(interval);
    }, [autoplay]);

    // Any MANUAL navigation cancels autoplay. This fires on every
    // position change (taps on moves/graph/engine lines, swipes, keys);
    // we ignore only the change autoplay made itself.
    useEffect(() => {
        if (autoplayStepRef.current) {
            autoplayStepRef.current = false;
            return;
        }
        setAutoplay(false);
    }, [node]);

    const topLine = getTopEngineLine(node.state.engineLines);
    const evaluation = topLine?.evaluation;

    // The engine's best move in the PREVIOUS position (what should
    // have been played instead of the actual move)
    const bestAlternative = useMemo(() => {
        if (!node.parent) return undefined;

        const parentTop = getTopEngineLine(node.parent.state.engineLines);
        const bestMove = parentTop?.moves.at(0);
        if (!bestMove) return undefined;

        // Don't suggest the move that was actually played
        if (bestMove.san == node.state.move?.san) return undefined;

        return bestMove;
    }, [node, treeVersion]);

    // Suggestion arrow on the board
    const arrows = useMemo((): [string, string, string?][] => {
        const arrowColour = classificationColours[Classification.BEST];

        if (arrowMode == "continuation") {
            const uci = topLine?.moves.at(0)?.uci;
            if (!uci) return [];

            return [[uci.slice(0, 2), uci.slice(2, 4), arrowColour]];
        }

        if (arrowMode == "alternative") {
            if (!bestAlternative) return [];

            const uci = bestAlternative.uci;
            return [[uci.slice(0, 2), uci.slice(2, 4), arrowColour]];
        }

        return [];
    }, [arrowMode, topLine, bestAlternative, treeVersion]);

    // Tapping "X was the best move" plays it as a variation
    function exploreBestAlternative() {
        if (!bestAlternative || !node.parent) return;

        try {
            const move = new Chess(node.parent.state.fen)
                .move(bestAlternative.san);

            const { goToNode } = useAppStore.getState();

            // Walk back to the parent, then add/enter the best move
            goToNode(node.parent, true);
            addMove(move);
        } catch {
            // ignore malformed moves
        }
    }

    const classifCounts = useMemo(
        () => analysed ? countClassifications(game.stateTree) : null,
        [analysed, game.stateTree, treeVersion]
    );

    const lastMove = useMemo(() => {
        if (!node.state.move || !node.parent) return undefined;

        try {
            return new Chess(node.parent.state.fen)
                .move(node.state.move.san);
        } catch {
            return undefined;
        }
    }, [node]);

    const lastMoveSquares = useMemo(() => {
        if (!lastMove) return {};

        const colour = node.state.classification
            ? classificationColours[node.state.classification] + "66"
            : "rgba(0, 122, 255, 0.4)";

        return {
            [lastMove.from]: { backgroundColor: colour },
            [lastMove.to]: { backgroundColor: colour }
        };
    }, [lastMove, node]);

    // -------- Tap-to-move with legal move dots (chess.com style) ----

    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

    // Clear selection whenever the position changes
    useEffect(() => setSelectedSquare(null), [node]);

    const legalTargets = useMemo(() => {
        if (!selectedSquare) return new Map<string, boolean>();

        try {
            const board = new Chess(node.state.fen);
            const moves = board.moves({
                square: selectedSquare as any,
                verbose: true
            });

            // square -> isCapture
            return new Map(moves.map(move => [
                move.to as string,
                move.isCapture() || move.isEnPassant()
            ]));
        } catch {
            return new Map<string, boolean>();
        }
    }, [selectedSquare, node]);

    const tapSquareStyles = useMemo(() => {
        const styles: Record<string, React.CSSProperties> = {};

        if (!selectedSquare) return styles;

        // Highlight the selected piece's square
        styles[selectedSquare] = {
            backgroundColor: "rgba(0, 122, 255, 0.5)"
        };

        // Dots on legal destinations; rings on captures
        for (const [square, isCapture] of legalTargets) {
            styles[square] = isCapture
                ? {
                    background:
                        "radial-gradient(circle, transparent 56%, "
                        + "rgba(40, 30, 16, 0.35) 57%)"
                }
                : {
                    background:
                        "radial-gradient(circle, "
                        + "rgba(40, 30, 16, 0.35) 27%, transparent 28%)"
                };
        }

        return styles;
    }, [selectedSquare, legalTargets]);

    const squareStyles = useMemo(
        () => ({ ...lastMoveSquares, ...tapSquareStyles }),
        [lastMoveSquares, tapSquareStyles]
    );

    /**
     * Is from->to a LEGAL promoting move in the current position?
     * Used for click-to-move (our own picker) and for the board's
     * native drag promotion dialog (onPromotionCheck). Crucially this
     * is legality-aware, so it never fires for illegal drags or when
     * it isn't that side's turn.
     */
    function isPromotion(from: string, to: string) {
        try {
            return new Chess(node.state.fen)
                .moves({ square: from as any, verbose: true })
                .some(move => move.to == to && Boolean(move.promotion));
        } catch {
            return false;
        }
    }

    /** Play from->to (optionally with a chosen promotion piece). */
    function commitMove(
        from: string,
        to: string,
        promotionPiece: "q" | "r" | "b" | "n"
    ) {
        try {
            const move: Move = new Chess(node.state.fen).move({
                from, to, promotion: promotionPiece
            });

            setSelectedSquare(null);
            addMove(move);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Tap-to-move entry point. For a legal promotion it opens OUR picker
     * (the board's native dialog only covers drag-and-drop); otherwise
     * it plays the move directly.
     */
    function tryMove(from: string, to: string) {
        if (isPromotion(from, to)) {
            setSelectedSquare(null);
            setPromotion({ from, to });
            return true;
        }
        return commitMove(from, to, "q");
    }

    function completePromotion(piece: "q" | "r" | "b" | "n") {
        if (!promotion) return;
        const { from, to } = promotion;
        setPromotion(null);
        commitMove(from, to, piece);
    }

    function onSquareClick(square: string) {
        // Tapping a legal destination: play the move
        if (selectedSquare && legalTargets.has(square)) {
            tryMove(selectedSquare, square);
            return;
        }

        // Tapping the selected piece again: deselect
        if (square == selectedSquare) {
            setSelectedSquare(null);
            return;
        }

        // Tapping one of own pieces: select it (whoever's turn it is)
        try {
            const board = new Chess(node.state.fen);
            const piece = board.get(square as any);

            if (piece && piece.color == board.turn()) {
                setSelectedSquare(square);
                return;
            }
        } catch { /* ignore */ }

        // Tapping anything else: clear selection
        setSelectedSquare(null);
    }

    // Position of the classification badge: pinned to the corner of
    // the move's destination square.
    const badgePosition = useMemo(() => {
        if (!lastMove) return undefined;

        const file = lastMove.to.charCodeAt(0) - 97; // a-h -> 0-7
        const rank = parseInt(lastMove.to[1]) - 1;   // 1-8 -> 0-7

        const squareSize = boardWidth / 8;

        const x = flipped ? 7 - file : file;
        const y = flipped ? rank : 7 - rank;

        return {
            left: (x + 1) * squareSize - 13,
            top: y * squareSize - 9
        };
    }, [lastMove, boardWidth, flipped]);

    const startAnalysis = analysis.start;
    const onSave = analysis.save;

    function onPieceDrop(from: string, to: string) {
        // Drag promotions use OUR dark-themed picker, not the library's
        // white modal. We open it here and return true so the board
        // doesn't snap the pawn back; the actual move is committed when
        // the user picks a piece (completePromotion).
        if (isPromotion(from, to)) {
            setPromotion({ from, to });
            return true;
        }

        return commitMove(from, to, "q");
    }

    /**
     * Always return false so react-chessboard NEVER opens its own
     * (white, off-theme) promotion dialog. Drag promotions are handled
     * by onPieceDrop -> our custom picker instead.
     */
    function onPromotionCheck() {
        return false;
    }

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
                    onPieceDragBegin={(_piece, square) => {
                        // Dragging also shows the dots
                        try {
                            const board = new Chess(node.state.fen);
                            const piece = board.get(square as any);

                            if (piece && piece.color == board.turn()) {
                                setSelectedSquare(square as string);
                            }
                        } catch { /* ignore */ }
                    }}
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
                    ? (analysisProgress?.stage == "preparing"
                        ? "Preparing…"
                        : analysisProgress?.stage == "classifying"
                            ? "Classifying…"
                            : `Analysing... ${Math.round(
                                (analysisProgress?.progress || 0) * 100
                            )}%`)
                    + ((analysisProgress?.cloudHits || 0) > 0
                        ? ` · ☁ ${analysisProgress?.cloudHits}`
                        : "")
                    + ((analysisProgress?.cacheHits || 0) > 0
                        ? ` · ⚡${analysisProgress?.cacheHits}`
                        : "")
                    + " (tap to cancel)"
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

function PlayerRow(props: {
    name: string;
    rating?: number;
    accuracy?: number;
}) {
    return <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "2px 2px"
    }}>
        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            {props.name}
        </span>

        {props.rating && <span style={{
            color: "var(--text-dim)",
            fontSize: "0.8rem"
        }}>
            ({props.rating})
        </span>}

        {props.accuracy != undefined && !isNaN(props.accuracy) && <span style={{
            marginLeft: "auto",
            background: "var(--surface-2)",
            color: "var(--text)",
            fontWeight: 800,
            fontSize: 12,
            borderRadius: 6,
            padding: "2px 8px",
            border: "1px solid var(--line-strong)"
        }}>
            {props.accuracy.toFixed(1)}%
        </span>}
    </div>;
}

function NavButton(props: {
    icon: React.ReactNode;
    onClick: () => void;
    grow?: boolean;
    label?: string;
}) {
    return <button
        onClick={props.onClick}
        aria-label={props.label}
        title={props.label}
        style={{
            flex: props.grow ? 2 : 1,
            padding: "11px 0",
            borderRadius: "var(--r-sm)",
            background: "var(--surface-2)",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        }}
    >
        {props.icon}
    </button>;
}

const PROMO_GLYPHS: Record<string, Record<string, string>> = {
    w: { q: "♕", r: "♖", b: "♗", n: "♘" },
    b: { q: "♛", r: "♜", b: "♝", n: "♞" }
};

function PromotionDialog(props: {
    colour: "w" | "b";
    onPick: (piece: "q" | "r" | "b" | "n") => void;
    onCancel: () => void;
}) {
    const pieces: ("q" | "r" | "b" | "n")[] = ["q", "r", "b", "n"];

    return <div
        onClick={props.onCancel}
        style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        }}
    >
        <div
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-label="Choose promotion piece"
            style={{
                background: "var(--surface-1)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-lg)",
                padding: 16,
                display: "flex",
                gap: 10
            }}
        >
            {pieces.map(piece => <button
                key={piece}
                onClick={() => props.onPick(piece)}
                aria-label={{
                    q: "Queen", r: "Rook", b: "Bishop", n: "Knight"
                }[piece]}
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    fontSize: 34,
                    lineHeight: 1,
                    color: "var(--text)",
                    cursor: "pointer"
                }}
            >
                {PROMO_GLYPHS[props.colour][piece]}
            </button>)}
        </div>
    </div>;
}

export default AnalysisScreen;
