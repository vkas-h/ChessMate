import { create } from "zustand";
import { Chess, Move } from "chess.js";
import { uniqueId } from "lodash-es";

import AnalysedGame from "@/types/game/AnalysedGame";
import { StateTreeNode } from "@/types/game/position/StateTreeNode";
import { defaultAnalysedGame } from "@/constants/utils";
import PieceColour from "@/constants/PieceColour";
import parseStateTree from "@/lib/stateTree/parse";
import Game from "@/types/game/Game";

import { AnalysisProgress } from "./engine/analyse";
import { playMoveSound } from "./lib/sounds";

export type Screen = "home" | "analysis" | "library" | "settings" | "stats";

/* ------------------- history / back-button sync -------------------
 * "home" is the root entry. Drill-downs (loading a game) PUSH an
 * entry; tab switches REPLACE; the share dialog pushes one more.
 * The Android back button (and browser back) then walks this stack
 * instead of exiting the app.
 */
let historyDepth = 0;
let suppressNextPop = false;

function pushEntry(screen: Screen, dialog = false) {
    try {
        window.history.pushState({ screen, dialog }, "");
        historyDepth++;
    } catch { /* history may be unavailable (tests) */ }
}

function replaceEntry(screen: Screen) {
    try {
        window.history.replaceState({ screen }, "");
    } catch { /* ignore */ }
}

/** Call once at app startup. */
export function initHistorySync() {
    try {
        window.history.replaceState({ screen: "home" }, "");
    } catch { /* ignore */ }

    window.addEventListener("popstate", event => {
        if (historyDepth > 0) historyDepth--;

        if (suppressNextPop) {
            suppressNextPop = false;
            return;
        }

        const store = useAppStore.getState();

        // Back closes the share dialog first (Android etiquette)
        if (store.shareOpen) {
            useAppStore.setState({ shareOpen: false });
            return;
        }

        // Then it returns from the Game Report to the board.
        if (store.analysisView == "report") {
            useAppStore.setState({ analysisView: "board" });
            return;
        }

        const target: Screen =
            (event.state && event.state.screen) || "home";

        if (target == store.screen) {
            // No visible change (e.g. a replaced duplicate entry):
            // consume another step so back always does something.
            if (historyDepth > 0) window.history.back();
            return;
        }

        useAppStore.setState({ screen: target });
    });
}


/**
 * The child that continues the CURRENT line: prefer the node marked
 * as mainline, otherwise the first (priority) child.
 */
export function getNextChild(node: StateTreeNode) {
    return node.children.find(child => child.mainline)
        || node.children.at(0);
}

/** Follow priority children from the root to build the mainline. */
export function getMainlineChain(rootNode: StateTreeNode) {
    const chain: StateTreeNode[] = [rootNode];

    let current: StateTreeNode | undefined = getNextChild(rootNode);

    while (current) {
        chain.push(current);
        current = getNextChild(current);
    }

    return chain;
}

interface AppState {
    screen: Screen;
    game: AnalysedGame;
    /** The node whose position is on the board right now. */
    currentNode: StateTreeNode;
    /**
     * Bumped whenever the tree is mutated in place (evals arriving,
     * classifications, new variation nodes) to trigger re-renders.
     */
    treeVersion: number;
    flipped: boolean;

    /** False until the user actually imports/opens a game. */
    gameLoaded: boolean;

    analysing: boolean;
    analysisProgress: AnalysisProgress | null;
    analysed: boolean;
    accuracies?: { white: number; black: number };
    libraryId?: string;

    /** Share dialog open state (in store so Back can close it). */
    shareOpen: boolean;
    setShareOpen: (open: boolean) => void;

    /**
     * Which sub-view of the Analyse tab is showing: the board/engine
     * view or the separate Game Report page. In the store so the
     * Android/browser back button can return report -> board.
     */
    analysisView: "board" | "report";
    setAnalysisView: (view: "board" | "report") => void;

    /** Search state persists across screen switches. */
    searchResults: Game[];
    searchUsername: string;
    setSearchResults: (games: Game[], username: string) => void;

    setScreen: (screen: Screen) => void;
    loadGame: (game: Game) => void;
    goToNode: (node: StateTreeNode, silent?: boolean) => void;
    stepForward: () => void;
    stepBackward: () => void;
    goToStart: () => void;
    goToEnd: () => void;
    flipBoard: () => void;
    addMove: (move: Move) => void;
    bumpTreeVersion: () => void;

    setAnalysing: (analysing: boolean) => void;
    setAnalysisProgress: (progress: AnalysisProgress | null) => void;
    finishAnalysis: (accuracies: { white: number; black: number }) => void;
    setLibraryId: (id?: string) => void;
    setLoadedAnalysis: (
        game: AnalysedGame,
        accuracies?: { white: number; black: number }
    ) => void;
}

function buildAnalysedGame(game: Game): AnalysedGame {
    return {
        ...game,
        stateTree: parseStateTree(game)
    };
}

export const useAppStore = create<AppState>((set, get) => ({
    screen: "home",
    game: defaultAnalysedGame,
    currentNode: defaultAnalysedGame.stateTree,
    treeVersion: 0,
    flipped: false,
    gameLoaded: false,

    analysing: false,
    analysisProgress: null,
    analysed: false,
    accuracies: undefined,
    libraryId: undefined,

    shareOpen: false,

    setShareOpen: open => {
        if (open) {
            pushEntry(get().screen, true);
            set({ shareOpen: true });
        } else if (get().shareOpen) {
            // Closed via UI (✕/backdrop): consume the pushed entry
            // without re-triggering navigation.
            suppressNextPop = true;
            set({ shareOpen: false });
            try { window.history.back(); } catch { /* ignore */ }
        }
    },

    analysisView: "board",

    setAnalysisView: view => {
        const current = get().analysisView;
        if (view == current) return;

        if (view == "report") {
            // Opening the report pushes a history entry so Back returns
            // to the board (mirrors the share-dialog pattern).
            pushEntry(get().screen);
            set({ analysisView: "report" });
        } else {
            // Returning to the board via UI: consume the pushed entry.
            suppressNextPop = true;
            set({ analysisView: "board" });
            try { window.history.back(); } catch { /* ignore */ }
        }
    },

    searchResults: [],
    searchUsername: "",
    setSearchResults: (games, username) => set({
        searchResults: games,
        searchUsername: username
    }),

    // Tab switches REPLACE the current entry (tabs are siblings, not
    // a drill-down) - back from any tab goes towards "home"/exit.
    setScreen: screen => {
        const current = get().screen;
        if (screen == current) return;

        // Close the dialog if open (without history games)
        if (get().shareOpen) {
            suppressNextPop = true;
            set({ shareOpen: false });
            try { window.history.back(); } catch { /* ignore */ }
        }

        if (screen == "settings" || screen == "stats") {
            // Drill-down screens (gear / insights): push so Back returns
            // to wherever you were.
            pushEntry(screen);
        } else if (screen == "home") {
            // Going to root: replace, depth stays
            replaceEntry(screen);
        } else if (current == "home") {
            // Leaving root: push so back returns to home
            pushEntry(screen);
        } else {
            // library <-> analysis: replace (siblings)
            replaceEntry(screen);
        }

        set({ screen });
    },

    loadGame: game => {
        const analysedGame = buildAnalysedGame(game);

        // Drill-down: opening a game pushes a history entry so the
        // Android/browser back button returns to the previous screen
        // (e.g. the searched game list).
        if (get().screen != "analysis") pushEntry("analysis");

        set({
            game: analysedGame,
            currentNode: analysedGame.stateTree,
            treeVersion: get().treeVersion + 1,
            gameLoaded: true,
            analysed: false,
            analysing: false,
            analysisProgress: null,
            accuracies: undefined,
            libraryId: undefined,
            analysisView: "board",
            screen: "analysis"
        });
    },

    setLoadedAnalysis: (game, accuracies) => {
        if (get().screen != "analysis") pushEntry("analysis");

        set({
            game,
            currentNode: game.stateTree,
            treeVersion: get().treeVersion + 1,
            gameLoaded: true,
            analysed: true,
            analysing: false,
            analysisProgress: null,
            accuracies,
            analysisView: "board",
            screen: "analysis"
        });
    },

    goToNode: (node, silent) => {
        const { currentNode } = get();
        if (node == currentNode) return;

        if (!silent && node.state.move && node.parent) {
            try {
                const move = new Chess(node.parent.state.fen)
                    .move(node.state.move.san);

                playMoveSound(move, new Chess(node.state.fen).isCheck());
            } catch {
                // sound is best-effort
            }
        }

        set({ currentNode: node });
    },

    stepForward: () => {
        const next = getNextChild(get().currentNode);
        if (next) get().goToNode(next);
    },

    stepBackward: () => {
        const parent = get().currentNode.parent;
        if (parent) get().goToNode(parent, true);
    },

    goToStart: () => get().goToNode(get().game.stateTree, true),

    goToEnd: () => {
        // Follow the CURRENT line to its end (mainline if on mainline,
        // the variation's end if inside a variation)
        let node = get().currentNode;

        let next = getNextChild(node);
        while (next) {
            node = next;
            next = getNextChild(node);
        }

        get().goToNode(node, true);
    },

    flipBoard: () => set(state => ({ flipped: !state.flipped })),

    addMove: move => {
        const { currentNode } = get();

        // If this move already exists as a child (mainline OR an
        // existing variation), just navigate into it - no duplicates.
        const existing = currentNode.children.find(
            child => child.state.move?.san == move.san
        );

        if (existing) return get().goToNode(existing);

        // Otherwise create a new variation branch. Pushed at the END
        // of children so the imported mainline stays the priority
        // child - the original game is never disturbed.
        const newNode: StateTreeNode = {
            id: uniqueId("user"),
            mainline: false,
            parent: currentNode,
            children: [],
            state: {
                fen: move.after,
                engineLines: [],
                move: { san: move.san, uci: move.lan },
                moveColour: move.color == "w"
                    ? PieceColour.WHITE
                    : PieceColour.BLACK
            }
        };

        currentNode.children.push(newNode);

        try {
            playMoveSound(move, new Chess(move.after).isCheck());
        } catch { /* ignore */ }

        set({
            currentNode: newNode,
            treeVersion: get().treeVersion + 1
        });
    },

    bumpTreeVersion: () =>
        set(state => ({ treeVersion: state.treeVersion + 1 })),

    setAnalysing: analysing => set({ analysing }),
    setAnalysisProgress: progress => set({ analysisProgress: progress }),

    finishAnalysis: accuracies => set(state => ({
        analysing: false,
        analysisProgress: null,
        analysed: true,
        accuracies,
        treeVersion: state.treeVersion + 1
    })),

    setLibraryId: id => set({ libraryId: id })
}));
