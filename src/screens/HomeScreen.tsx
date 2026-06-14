import React, { useState } from "react";
import { ArrowRight, Calendar, Loader2 } from "lucide-react";

import Game from "@/types/game/Game";
import GameResult from "@/constants/game/GameResult";

import { useAppStore } from "../store";
import {
    parsePgn,
    getChessComGames,
    getLichessGames
} from "../lib/importers";

type Source = "pgn" | "chesscom" | "lichess";

const sources: { id: Source; label: string }[] = [
    { id: "pgn", label: "PGN" },
    { id: "chesscom", label: "Chess.com" },
    { id: "lichess", label: "Lichess" }
];

const resultColours: Record<string, string> = {
    [GameResult.WIN]: "var(--good)",
    [GameResult.LOSE]: "var(--bad)",
    [GameResult.DRAW]: "var(--text-dim)",
    [GameResult.UNKNOWN]: "var(--text-faint)"
};

const resultLabels: Record<string, string> = {
    [GameResult.WIN]: "WIN",
    [GameResult.LOSE]: "LOSS",
    [GameResult.DRAW]: "DRAW",
    [GameResult.UNKNOWN]: "—"
};

function HomeScreen() {
    const loadGame = useAppStore(state => state.loadGame);

    const games = useAppStore(state => state.searchResults);
    const storedUsername = useAppStore(state => state.searchUsername);
    const setSearchResults = useAppStore(state => state.setSearchResults);

    const [source, setSource] = useState<Source>(
        games.length > 0 ? "chesscom" : "pgn"
    );
    const [pgn, setPgn] = useState("");
    const [username, setUsername] = useState(storedUsername);

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    function importPgn() {
        setError("");

        try {
            loadGame(parsePgn(pgn));
        } catch {
            setError("Could not parse that PGN. Check the format!");
        }
    }

    async function fetchGames() {
        if (!username.trim()) return;

        setError("");
        setLoading(true);
        setSearchResults([], username.trim());

        try {
            const fetched = source == "chesscom"
                ? await getChessComGames(username.trim(), month, year)
                : await getLichessGames(username.trim(), month, year);

            setSearchResults(fetched, username.trim());
            if (fetched.length == 0)
                setError("No games found for that month.");
        } catch {
            setError("Could not fetch games. Check the username / connection.");
        } finally {
            setLoading(false);
        }
    }

    return <div style={{ padding: "24px 16px" }}>
        {/* brand header */}
        <header style={{ marginBottom: 24 }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10
            }}>
                <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: var_r("md"),
                    background:
                        "linear-gradient(135deg, var(--accent) 0%, #a87f2c 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    color: "var(--accent-text)",
                    flexShrink: 0
                }}>
                    ♞
                </div>

                <div>
                    <h1 style={{
                        margin: 0,
                        fontSize: 24,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1
                    }}>
                        ChessMate
                    </h1>
                    <p style={{
                        margin: 0,
                        color: "var(--text-dim)",
                        fontSize: 13
                    }}>
                        On-device game analysis
                    </p>
                </div>
            </div>
        </header>

        {/* segmented source control */}
        <div style={{
            display: "flex",
            background: "var(--surface-1)",
            borderRadius: var_r("md"),
            padding: 4,
            marginBottom: 16
        }}>
            {sources.map(item => {
                const active = source == item.id;

                return <button
                    key={item.id}
                    onClick={() => {
                        setSource(item.id);
                        setError("");
                        setSearchResults([], username.trim());
                    }}
                    style={{
                        flex: 1,
                        padding: "9px 0",
                        borderRadius: var_r("sm"),
                        fontSize: 14,
                        fontWeight: 700,
                        background: active
                            ? "var(--surface-3)" : "transparent",
                        color: active ? "var(--text)" : "var(--text-faint)",
                        boxShadow: active
                            ? "0 1px 4px rgba(0,0,0,0.35)" : "none"
                    }}
                >
                    {item.label}
                </button>;
            })}
        </div>

        {source == "pgn" && <>
            <textarea
                value={pgn}
                onChange={event => setPgn(event.target.value)}
                placeholder={"Paste a PGN here…\n\n1. e4 e5 2. Nf3 Nc6 …"}
                style={{
                    width: "100%",
                    height: 180,
                    background: "var(--surface-1)",
                    border: "1px solid transparent",
                    borderRadius: var_r("md"),
                    color: "var(--text)",
                    padding: 14,
                    fontSize: 14,
                    resize: "vertical"
                }}
            />

            <PrimaryButton
                onClick={importPgn}
                disabled={!pgn.trim()}
                label="Load game"
            />
        </>}

        {source != "pgn" && <>
            <div style={{ display: "flex", gap: 8 }}>
                <input
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    onKeyDown={event => {
                        if (event.key == "Enter") void fetchGames();
                    }}
                    placeholder={`${source == "chesscom"
                        ? "Chess.com" : "Lichess"} username`}
                    style={{
                        flex: 1,
                        background: "var(--surface-1)",
                        border: "1px solid transparent",
                        borderRadius: var_r("md"),
                        color: "var(--text)",
                        padding: "12px 14px",
                        fontSize: 15,
                        minWidth: 0
                    }}
                />
            </div>

            <div style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                alignItems: "center"
            }}>
                <Calendar
                    size={16}
                    style={{ color: "var(--text-faint)", flexShrink: 0 }}
                />

                <select
                    value={month}
                    onChange={event => setMonth(Number(event.target.value))}
                    style={selectStyle}
                >
                    {Array.from({ length: 12 }, (_, index) => (
                        <option key={index} value={index + 1}>
                            {new Date(2000, index)
                                .toLocaleString("en", { month: "long" })}
                        </option>
                    ))}
                </select>

                <select
                    value={year}
                    onChange={event => setYear(Number(event.target.value))}
                    style={selectStyle}
                >
                    {Array.from({ length: 6 }, (_, index) => {
                        const optionYear = now.getFullYear() - index;
                        return <option key={optionYear} value={optionYear}>
                            {optionYear}
                        </option>;
                    })}
                </select>
            </div>

            <PrimaryButton
                onClick={() => void fetchGames()}
                disabled={loading || !username.trim()}
                label={loading ? "Fetching games…" : "Find games"}
                loading={loading}
            />

            {/* skeletons while loading */}
            {loading && <div style={{ marginTop: 16 }}>
                {[0, 1, 2, 3].map(index => <div
                    key={index}
                    className="skeleton"
                    style={{ height: 64, marginBottom: 8 }}
                />)}
            </div>}

            <div style={{ marginTop: 16 }}>
                {games.map((game, index) => {
                    const isWhite =
                        game.players.white.username?.toLowerCase()
                        == username.trim().toLowerCase();

                    const myResult = isWhite
                        ? game.players.white.result
                        : game.players.black.result;

                    return <button
                        key={index}
                        onClick={() =>
                            useAppStore.getState().loadGame(game)}
                        style={{
                            width: "100%",
                            textAlign: "left",
                            background: "var(--surface-1)",
                            borderLeft:
                                `3px solid ${resultColours[myResult]}`,
                            borderRadius: var_r("md"),
                            padding: "12px 14px",
                            marginBottom: 8,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8
                        }}
                    >
                        <div style={{ minWidth: 0 }}>
                            <div style={{
                                fontWeight: 700,
                                fontSize: 14,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}>
                                {game.players.white.username}
                                <span style={{
                                    color: "var(--text-faint)",
                                    fontWeight: 600
                                }}> vs </span>
                                {game.players.black.username}
                            </div>

                            <div style={{
                                color: "var(--text-faint)",
                                fontSize: 12,
                                marginTop: 2
                            }}>
                                {game.timeControl || "—"}
                                {game.date && " · " + new Date(game.date)
                                    .toLocaleDateString()}
                            </div>
                        </div>

                        <span style={{
                            fontSize: 12,
                            fontWeight: 800,
                            flexShrink: 0,
                            letterSpacing: "0.04em",
                            color: resultColours[myResult]
                        }}>
                            {resultLabels[myResult]}
                        </span>
                    </button>;
                })}
            </div>
        </>}

        {error && <p style={{
            color: "#e08886",
            fontSize: 13,
            marginTop: 12
        }}>
            {error}
        </p>}
    </div>;
}

function PrimaryButton(props: {
    onClick: () => void;
    disabled?: boolean;
    label: string;
    loading?: boolean;
}) {
    const enabled = !props.disabled;

    return <button
        onClick={props.onClick}
        disabled={props.disabled}
        style={{
            width: "100%",
            marginTop: 12,
            padding: "14px 0",
            borderRadius: var_r("md"),
            background: enabled ? "var(--accent)" : "var(--surface-2)",
            color: enabled ? "var(--accent-text)" : "var(--text-faint)",
            fontSize: 15,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8
        }}
    >
        {props.loading
            ? <Loader2 size={17} className="spin" style={{
                animation: "spin 0.9s linear infinite"
            }} />
            : null}
        {props.label}
        {!props.loading && enabled && <ArrowRight size={17} />}
    </button>;
}

const selectStyle: React.CSSProperties = {
    flex: 1,
    background: "var(--surface-1)",
    border: "1px solid transparent",
    borderRadius: "var(--r-sm)",
    color: "var(--text)",
    padding: "9px 8px",
    fontSize: 13
};

function var_r(size: "sm" | "md" | "lg") {
    return `var(--r-${size})`;
}

export default HomeScreen;
