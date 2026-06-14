import React, { useEffect, useState } from "react";
import { Library as LibraryIcon, Trash2 } from "lucide-react";

import GameResult from "@/constants/game/GameResult";

import { useAppStore } from "../store";
import {
    listGames,
    loadGame,
    deleteGame,
    SavedGameSummary
} from "../lib/library";

function LibraryScreen() {
    const setLoadedAnalysis = useAppStore(state => state.setLoadedAnalysis);

    const [games, setGames] = useState<SavedGameSummary[]>([]);
    const [loading, setLoading] = useState(true);

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
        await refresh();
    }

    return <div style={{ padding: "20px 16px" }}>
        <h1 style={{
            margin: "8px 0 4px",
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            gap: 10
        }}>
            <LibraryIcon size={22} style={{ color: "var(--accent)" }} />
            My library
        </h1>
        <p style={{
            margin: "0 0 18px",
            color: "var(--text-dim)",
            fontSize: "0.9rem"
        }}>
            Analysed games saved on this device
        </p>

        {loading && <p style={{ color: "var(--text-dim)" }}>Loading…</p>}

        {!loading && games.length == 0 && <div style={{
            textAlign: "center",
            padding: "48px 0",
            color: "var(--text-dim)"
        }}>
            <div style={{ fontSize: 38, marginBottom: 10, opacity: 0.5 }}>♞</div>
            Nothing here yet.<br />
            Analyse a game and tap "Save to library".
        </div>}

        {games.map(game => <div
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
                    {game.white} <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>vs</span> {game.black}
                </div>

                <div style={{
                    color: "var(--text-dim)",
                    fontSize: "0.78rem",
                    marginTop: 3,
                    display: "flex",
                    gap: 8
                }}>
                    <ResultTag result={game.whiteResult} />
                    {game.accuracies && !isNaN(game.accuracies.white) &&
                        <span>
                            {game.accuracies.white.toFixed(0)}% ·{" "}
                            {game.accuracies.black.toFixed(0)}%
                        </span>
                    }
                    <span>
                        {new Date(game.savedAt).toLocaleDateString()}
                    </span>
                </div>
            </button>

            <button
                onClick={() => void removeGame(game.id)}
                aria-label="Delete game"
                style={{
                    color: "var(--text-faint)",
                    padding: 8,
                    flexShrink: 0,
                    display: "flex"
                }}
            >
                <Trash2 size={17} />
            </button>
        </div>)}
    </div>;
}

function ResultTag(props: { result: string }) {
    const labels: Record<string, [string, string]> = {
        [GameResult.WIN]: ["1-0", "var(--good)"],
        [GameResult.LOSE]: ["0-1", "var(--bad)"],
        [GameResult.DRAW]: ["½-½", "var(--text-dim)"],
        [GameResult.UNKNOWN]: ["*", "var(--text-dim)"]
    };

    const [label, colour] = labels[props.result] || labels.unknown;

    return <span style={{ color: colour, fontWeight: 800 }}>{label}</span>;
}

export default LibraryScreen;
