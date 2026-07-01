import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Chess, Move } from "chess.js";

import { Classification } from "@/constants/Classification";
import {
    EngineLine,
    getTopEngineLine
} from "@/types/game/position/EngineLine";
import { StateTreeNode } from "@/types/game/position/StateTreeNode";

import { enginePool } from "../../engine/enginePool";
import { hydrateEvalCache } from "../../engine/evalCache";
import { realtimeAnalyser } from "../../engine/realtime";
import { useAppStore } from "../../store";
import { classificationColours } from "../../lib/classifications";

export type ArrowMode = "off" | "continuation" | "alternative";

export const arrowModeLabels: Record<ArrowMode, string> = {
    off: "Arrow: off",
    continuation: "Arrow: best now",
    alternative: "Arrow: best instead"
};

const ARROW_STORAGE_KEY = "chessmate:arrowMode";

export function useArrowMode() {
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

    return { arrowMode, cycleArrowMode };
}

export function useRealtimeAnalysis(
    node: StateTreeNode,
    analysing: boolean,
    gameLoaded: boolean,
    bumpTreeVersion: () => void
) {
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
}

export function useWarmAnalysisEngine() {
    useEffect(() => {
        void hydrateEvalCache();
        enginePool.warm();
    }, []);
}

export function useBoardSizing() {
    const [boardElement, setBoardElement] = useState<HTMLDivElement | null>(null);
    const [boardWidth, setBoardWidth] = useState(360);

    useEffect(() => {
        if (!boardElement) return;
        const element: HTMLDivElement = boardElement;

        function updateWidth() {
            setBoardWidth(
                Math.max(260, Math.min(element.clientWidth - 34, 520))
            );
        }

        updateWidth();

        const ResizeObserverCtor = window.ResizeObserver;
        if (ResizeObserverCtor) {
            const observer = new ResizeObserverCtor(updateWidth);
            observer.observe(element);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", updateWidth);
        return () => window.removeEventListener("resize", updateWidth);
    }, [boardElement]);

    return { boardAreaRef: setBoardElement, boardWidth };
}

export function useKeyboardNavigation(
    stepForward: () => void,
    stepBackward: () => void
) {
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }

            const target = event.target as HTMLElement | null;
            if (target?.closest(
                "input, textarea, select, [contenteditable='true']"
            )) return;

            // Modal sheets/dialogs own keyboard interaction while open.
            if (document.querySelector("[role='dialog'][aria-modal='true']")) {
                return;
            }

            if (event.key == "ArrowRight") stepForward();
            if (event.key == "ArrowLeft") stepBackward();
        }

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [stepForward, stepBackward]);
}

export function useAutoplay(node: StateTreeNode) {
    const [autoplay, setAutoplay] = useState(false);
    const autoplayStepRef = useRef(false);

    // Step forward every 1.2s until the line ends.
    useEffect(() => {
        if (!autoplay) return;

        const interval = setInterval(() => {
            const state = useAppStore.getState();
            const before = state.currentNode;

            autoplayStepRef.current = true;
            state.stepForward();

            if (useAppStore.getState().currentNode == before) {
                autoplayStepRef.current = false;
                setAutoplay(false);
            }
        }, 1200);

        return () => clearInterval(interval);
    }, [autoplay]);

    // Manual navigation cancels autoplay. Ignore only autoplay's own step.
    useEffect(() => {
        if (autoplayStepRef.current) {
            autoplayStepRef.current = false;
            return;
        }
        setAutoplay(false);
    }, [node]);

    return { autoplay, setAutoplay };
}

export function useBestMoveArrow(options: {
    node: StateTreeNode;
    topLine?: EngineLine;
    arrowMode: ArrowMode;
    treeVersion: number;
    addMove: (move: Move) => void;
}) {
    const { node, topLine, arrowMode, treeVersion, addMove } = options;

    const bestAlternative = useMemo(() => {
        if (!node.parent) return undefined;

        const parentTop = getTopEngineLine(node.parent.state.engineLines);
        const bestMove = parentTop?.moves.at(0);
        if (!bestMove) return undefined;

        if (bestMove.san == node.state.move?.san) return undefined;

        return bestMove;
    }, [node, treeVersion]);

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

    function exploreBestAlternative() {
        if (!bestAlternative || !node.parent) return;

        try {
            const move = new Chess(node.parent.state.fen)
                .move(bestAlternative.san);

            const { goToNode } = useAppStore.getState();
            goToNode(node.parent, true);
            addMove(move);
        } catch {
            // ignore malformed moves
        }
    }

    return { bestAlternative, arrows, exploreBestAlternative };
}

export function useBoardInteraction(options: {
    node: StateTreeNode;
    boardWidth: number;
    flipped: boolean;
    addMove: (move: Move) => void;
}) {
    const { node, boardWidth, flipped, addMove } = options;

    const [promotion, setPromotion] = useState<
        { from: string; to: string } | null
    >(null);
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

    useEffect(() => setSelectedSquare(null), [node]);

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

    const legalTargets = useMemo(() => {
        if (!selectedSquare) return new Map<string, boolean>();

        try {
            const board = new Chess(node.state.fen);
            const moves = board.moves({
                square: selectedSquare as any,
                verbose: true
            });

            return new Map(moves.map(move => [
                move.to as string,
                move.isCapture() || move.isEnPassant()
            ]));
        } catch {
            return new Map<string, boolean>();
        }
    }, [selectedSquare, node]);

    const tapSquareStyles = useMemo(() => {
        const styles: Record<string, CSSProperties> = {};

        if (!selectedSquare) return styles;

        styles[selectedSquare] = {
            backgroundColor: "rgba(0, 122, 255, 0.5)"
        };

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

    function isPromotion(from: string, to: string) {
        try {
            return new Chess(node.state.fen)
                .moves({ square: from as any, verbose: true })
                .some(move => move.to == to && Boolean(move.promotion));
        } catch {
            return false;
        }
    }

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
        if (selectedSquare && legalTargets.has(square)) {
            tryMove(selectedSquare, square);
            return;
        }

        if (square == selectedSquare) {
            setSelectedSquare(null);
            return;
        }

        try {
            const board = new Chess(node.state.fen);
            const piece = board.get(square as any);

            if (piece && piece.color == board.turn()) {
                setSelectedSquare(square);
                return;
            }
        } catch { /* ignore */ }

        setSelectedSquare(null);
    }

    function onPieceDrop(from: string, to: string) {
        if (isPromotion(from, to)) {
            setPromotion({ from, to });
            return true;
        }

        return commitMove(from, to, "q");
    }

    function onPieceDragBegin(_piece: string, square: string) {
        try {
            const board = new Chess(node.state.fen);
            const piece = board.get(square as any);

            if (piece && piece.color == board.turn()) {
                setSelectedSquare(square);
            }
        } catch { /* ignore */ }
    }

    const badgePosition = useMemo(() => {
        if (!lastMove) return undefined;

        const file = lastMove.to.charCodeAt(0) - 97;
        const rank = parseInt(lastMove.to[1]) - 1;
        const squareSize = boardWidth / 8;

        const x = flipped ? 7 - file : file;
        const y = flipped ? rank : 7 - rank;

        return {
            left: (x + 1) * squareSize - 13,
            top: y * squareSize - 9
        };
    }, [lastMove, boardWidth, flipped]);

    return {
        promotion,
        setPromotion,
        completePromotion,
        onPieceDrop,
        onPromotionCheck: () => false,
        onSquareClick,
        onPieceDragBegin,
        squareStyles,
        badgePosition
    };
}
