import React, { useEffect, useMemo, useState } from "react";
import { Library as LibraryIcon, Trash2, Search, X, BarChart3 } from "lucide-react";

import GameResult, {
    getOpinionatedGameResult
} from "@/constants/game/GameResult";
import PieceColour from "@/constants/PieceColour";

import { useAppStore } from "../store";
import {
    listGames,
    loadGame,
    deleteGame,
    SavedGameSummary
} from "../lib/library";
import { getUsername } from "../lib/settings";

type Sort = "recent" | "accuracy";

function LibraryScreen() {
    const setLoadedAnalysis = useAppStore(state => state.setLoadedAnalysis);
    const searchUsername = useAppStore(state => state.searchUsername);

    const perspectiveUsers = useMemo(() => uniqueLowercase([
        getUsername("chesscom"),
        getUsername("lichess"),
        searchUsername
    ]), [searchUsername]);

    const [games, setGames] = useState<SavedGameSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<Sort>("recent");
    const [confirmId, setConfirmId] = useState<string | null>(null);

    async function refresh() {
        setLoading(true);
        setGames(await listGames());
        setLoading(false);
    }

    useEffect(() => {
        void refresh();
    }, []);

    async function openGame(id: string) {
        const record = await loadGame(id);
        if (!record) return;

        setLoadedAnalysis(record.game, record.accuracies);
        useAppStore.getState().setLibraryId(id);
    }

    async function removeGame(id: string) {
        await deleteGame(id);
        setConfirmId(null);
        await refresh();
    }

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();

        const filtered = q
            ? games.filter(game =>
                game.white.toLowerCase().includes(q)
                || game.black.toLowerCase().includes(q))
            : games;

        if (sort == "accuracy") {
            return [...filtered].sort((a, b) =>
                sortableAccuracy(b, perspectiveUsers)
                - sortableAccuracy(a, perspectiveUsers)
            );
        }

        // already newest-first from listGames
        return filtered;
    }, [games, query, sort, perspectiveUsers]);

    return <div style={{ padding: "20px 16px 80px" }}>
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "8px 0 4px",
            gap: 10
        }}>
            <h1 style={{
                margin: 0,
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                gap: 10
            }}>
                <LibraryIcon size={22} style={{ color: "var(--accent)" }} />
                My library
            </h1>

            {games.length > 0 && <button
                onClick={() => useAppStore.getState().setScreen("stats")}
                aria-label="View insights"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: "var(--r-md)",
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent)",
                    color: "var(--accent)",
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0
                }}
            >
                <BarChart3 size={15} /> Insights
            </button>}
        </div>
        <p style={{
            margin: "0 0 16px",
            color: "var(--text-dim)",
            fontSize: "0.9rem"
        }}>
            Analysed games saved on this device
        </p>

        {/* Search + sort (only when there are games) */}
        {games.length > 0 && <div style={{
            display: "flex",
            gap: 8,
            marginBottom: 14
        }}>
            <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface-1)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                padding: "0 10px"
            }}>
                <Search size={15} style={{ color: "var(--text-faint)" }} />
                <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search players…"
                    style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: "var(--text)",
                        padding: "10px 0",
                        fontSize: 14,
                        minWidth: 0
                    }}
                />
                {query && <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    style={{ color: "var(--text-faint)", display: "flex" }}
                >
                    <X size={15} />
                </button>}
            </div>

            <button
                onClick={() => setSort(sort == "recent" ? "accuracy" : "recent")}
                style={{
                    flexShrink: 0,
                    padding: "0 12px",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-1)",
                    border: "1px solid var(--line)",
                    color: "var(--text-dim)",
                    fontSize: 12.5,
                    fontWeight: 700
                }}
            >
                Sort: {sort == "recent" ? "Recent" : "Accuracy"}
            </button>
        </div>}

        {loading && <p style={{ color: "var(--text-dim)" }}>Loading…</p>}

        {!loading && games.length == 0 && <div style={{
            textAlign: "center",
            padding: "64px 0",
            color: "var(--text-dim)"
        }}>
            <img
                src="/logo-knight.png"
                alt="ChessMate"
                style={{ width: 44, height: 44, marginBottom: 10, opacity: 0.4 }}
            /><br />
            Nothing here yet.<br />
            Analyse a game and tap "Save to library".
        </div>}

        {!loading && games.length > 0 && visible.length == 0 && <p style={{
            color: "var(--text-faint)",
            textAlign: "center",
            padding: "32px 0"
        }}>
            No games match "{query}".
        </p>}

        {visible.map(game => {
            const perspective = getUserPerspective(game, perspectiveUsers);
            const display = getDisplayPlayers(game, perspective);
            const userAccuracy = getUserAccuracy(game, perspectiveUsers);
            const opponentAccuracy = getOpponentAccuracy(game, perspectiveUsers);

            return <div
            key={game.id}
            style={{
                background: "var(--surface-1)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 10
            }}
        >
            <button
                onClick={() => void openGame(game.id)}
                style={{ flex: 1, textAlign: "left", minWidth: 0 }}
            >
                <div style={{
                    fontWeight: 700,
                    fontSize: "0.93rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                }}>
                    {display.primary} <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>vs</span> {display.opponent}
                </div>

                <div style={{
                    color: "var(--text-dim)",
                    fontSize: "0.78rem",
                    marginTop: 3,
                    display: "flex",
                    gap: 8
                }}>
                    <ResultTag whiteResult={game.whiteResult} perspective={perspective} />
                    {game.accuracies && !isNaN(userAccuracy) &&
                        <span>
                            {userAccuracy.toFixed(0)}% you
                            {!isNaN(opponentAccuracy)
                                ? ` · ${opponentAccuracy.toFixed(0)}% opp`
                                : ""}
                        </span>
                    }
                    <span>
                        {new Date(game.savedAt).toLocaleDateString()}
                    </span>
                </div>
            </button>

            {/* Delete with inline confirm */}
            {confirmId == game.id ? <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                    onClick={() => void removeGame(game.id)}
                    style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: "var(--bad)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 800
                    }}
                >
                    Delete
                </button>
                <button
                    onClick={() => setConfirmId(null)}
                    style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: "var(--surface-2)",
                        color: "var(--text-dim)",
                        fontSize: 12,
                        fontWeight: 700
                    }}
                >
                    Cancel
                </button>
            </div> : <button
                onClick={() => setConfirmId(game.id)}
                aria-label="Delete game"
                style={{
                    color: "var(--text-faint)",
                    padding: 8,
                    flexShrink: 0,
                    display: "flex"
                }}
            >
                <Trash2 size={17} />
            </button>}
        </div>;
        })}
    </div>;
}

function ResultTag(props: {
    whiteResult: string;
    perspective: PieceColour;
}) {
    const myResult = getOpinionatedGameResult(
        props.whiteResult as GameResult,
        props.perspective
    );

    const labels: Record<string, [string, string]> = {
        [GameResult.WIN]: ["WIN", "var(--good)"],
        [GameResult.LOSE]: ["LOSS", "var(--bad)"],
        [GameResult.DRAW]: ["DRAW", "var(--text-dim)"],
        [GameResult.UNKNOWN]: ["—", "var(--text-dim)"]
    };

    const [label, colour] = labels[myResult] || labels[GameResult.UNKNOWN];

    return <span style={{ color: colour, fontWeight: 800 }}>
        {label}
    </span>;
}

function lc(value?: string) {
    return (value || "").trim().toLowerCase();
}

function uniqueLowercase(values: string[]) {
    return [...new Set(values.map(lc).filter(Boolean))];
}

function getUserPerspective(
    game: SavedGameSummary,
    usernames: string[]
): PieceColour {
    const white = lc(game.white);
    const black = lc(game.black);

    if (usernames.some(user => user == black)) return PieceColour.BLACK;
    if (usernames.some(user => user == white)) return PieceColour.WHITE;

    // Fallback for old/imported games when no saved username matches:
    // keep the raw PGN/white perspective rather than guessing.
    return PieceColour.WHITE;
}

function getDisplayPlayers(game: SavedGameSummary, perspective: PieceColour) {
    return perspective == PieceColour.BLACK
        ? { primary: game.black || "Black", opponent: game.white || "White" }
        : { primary: game.white || "White", opponent: game.black || "Black" };
}

function getUserAccuracy(game: SavedGameSummary, usernames: string[]) {
    if (!game.accuracies) return NaN;
    return getUserPerspective(game, usernames) == PieceColour.BLACK
        ? game.accuracies.black
        : game.accuracies.white;
}

function getOpponentAccuracy(game: SavedGameSummary, usernames: string[]) {
    if (!game.accuracies) return NaN;
    return getUserPerspective(game, usernames) == PieceColour.BLACK
        ? game.accuracies.white
        : game.accuracies.black;
}

function sortableAccuracy(game: SavedGameSummary, usernames: string[]) {
    const accuracy = getUserAccuracy(game, usernames);
    return Number.isNaN(accuracy) ? -1 : accuracy;
}

export default LibraryScreen;
