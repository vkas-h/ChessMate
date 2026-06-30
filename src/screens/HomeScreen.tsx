import React, { useMemo, useState } from "react";
import { ArrowRight, Calendar, Loader2, User, FileText } from "lucide-react";

import Game from "@/types/game/Game";
import GameResult from "@/constants/game/GameResult";

import { useAppStore } from "../store";
import {
    parsePgn,
    getChessComGames,
    getLichessGames,
    getRecentChessComGames,
    getRecentLichessGames
} from "../lib/importers";

type Source = "pgn" | "chesscom" | "lichess";
type FetchMode = "recent" | "month";

const sources: { id: Source; label: string }[] = [
    { id: "pgn", label: "PGN" },
    { id: "chesscom", label: "Chess.com" },
    { id: "lichess", label: "Lichess" }
];

/* Persist usernames per platform so they survive app restarts. */
const USERNAME_KEY: Record<"chesscom" | "lichess", string> = {
    chesscom: "chessmate:username:chesscom",
    lichess: "chessmate:username:lichess"
};

function loadSavedUsername(platform: "chesscom" | "lichess"): string {
    try {
        return localStorage.getItem(USERNAME_KEY[platform]) || "";
    } catch {
        return "";
    }
}

function saveUsername(platform: "chesscom" | "lichess", value: string) {
    try {
        localStorage.setItem(USERNAME_KEY[platform], value);
    } catch { /* storage may be unavailable */ }
}

const resultColours: Record<string, string> = {
    [GameResult.WIN]: "var(--accent)",
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

function countPgnMoves(pgn: string): number {
    return (pgn
        .replace(/\{[^}]*\}/g, " ")
        .replace(/\([^)]*\)/g, " ")
        .match(/\b\d+\.(?:\.\.)?/g) || []).length;
}

/** How many recent games to reveal at a time. */
const PAGE = 8;

function HomeScreen() {
    const loadGame = useAppStore(state => state.loadGame);

    const games = useAppStore(state => state.searchResults);
    const storedUsername = useAppStore(state => state.searchUsername);
    const setSearchResults = useAppStore(state => state.setSearchResults);

    const [source, setSource] = useState<Source>(
        games.length > 0 ? "chesscom" : "pgn"
    );
    const [pgn, setPgn] = useState("");
    const [username, setUsername] = useState(
        storedUsername || loadSavedUsername("chesscom")
    );

    const now = new Date();
    const [fetchMode, setFetchMode] = useState<FetchMode>("recent");
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [visibleCount, setVisibleCount] = useState(PAGE);

    const pgnPreview = useMemo(() => {
        if (!pgn.trim()) return null;

        try {
            return {
                game: parsePgn(pgn),
                moveCount: countPgnMoves(pgn),
                error: ""
            };
        } catch {
            return {
                game: undefined,
                moveCount: 0,
                error: "Could not parse that PGN yet."
            };
        }
    }, [pgn]);

    function importPgn() {
        setError("");
        if (pgnPreview?.game) {
            loadGame(pgnPreview.game);
        } else {
            setError("Could not parse that PGN. Check the format!");
        }
    }

    async function importPgnFile(file: File) {
        setError("");
        try {
            setPgn(await file.text());
        } catch {
            setError("Could not read that PGN file.");
        }
    }

    async function fetchGames() {
        if (!username.trim()) return;

        const isFuture = fetchMode == "month"
            && (year > now.getFullYear()
                || (year == now.getFullYear() && month > now.getMonth() + 1));
        if (isFuture) {
            setError("That month is in the future — pick an earlier month.");
            return;
        }

        setError("");
        setLoading(true);
        setVisibleCount(PAGE);
        setSearchResults([], username.trim());

        try {
            const fetched = source == "chesscom"
                ? fetchMode == "recent"
                    ? await getRecentChessComGames(username.trim())
                    : await getChessComGames(username.trim(), month, year)
                : fetchMode == "recent"
                    ? await getRecentLichessGames(username.trim())
                    : await getLichessGames(username.trim(), month, year);

            setSearchResults(fetched, username.trim());

            if (source == "chesscom" || source == "lichess") {
                saveUsername(source, username.trim());
            }

            if (fetched.length == 0)
                setError(fetchMode == "recent"
                    ? "No recent games found."
                    : "No games found for that month.");
        } catch (err) {
            setError(err instanceof Error
                ? err.message
                : "Could not fetch games. Check the username / connection.");
        } finally {
            setLoading(false);
        }
    }

    const heading = source == "pgn" ? "Import PGN" : "Data Source";
    const subtitle = source == "pgn"
        ? "Paste a game in PGN notation to analyse."
        : "Select the platform to import your recent game history.";

    return <div style={{ padding: "24px 16px 96px" }}>
        {/* Heading */}
        <header style={{ marginBottom: 18 }}>
            <h1 style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.02em"
            }}>
                {heading}
            </h1>
            <p style={{
                margin: "4px 0 0",
                color: "var(--text-dim)",
                fontSize: 14
            }}>
                {subtitle}
            </p>
        </header>

        {/* segmented source control */}
        <div style={{
            display: "flex",
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            borderRadius: var_r("md"),
            padding: 4,
            marginBottom: 18
        }}>
            {sources.map(item => {
                const active = source == item.id;

                return <button
                    key={item.id}
                    onClick={() => {
                        setSource(item.id);
                        setError("");
                        setVisibleCount(PAGE);
                        setSearchResults([], username.trim());

                        if (item.id == "chesscom" || item.id == "lichess") {
                            setUsername(loadSavedUsername(item.id));
                        }
                    }}
                    style={{
                        flex: 1,
                        padding: "9px 0",
                        borderRadius: var_r("sm"),
                        fontSize: 14,
                        fontWeight: 700,
                        background: active ? "var(--surface-3)" : "transparent",
                        color: active ? "var(--text)" : "var(--text-faint)",
                        boxShadow: active ? "0 1px 4px rgba(0,0,0,0.4)" : "none"
                    }}
                >
                    {item.label}
                </button>;
            })}
        </div>

        {/* PGN form */}
        {source == "pgn" && <div style={cardStyle}>
            <Label icon={<FileText size={13} />}>PGN</Label>
            <textarea
                value={pgn}
                onChange={event => setPgn(event.target.value)}
                placeholder={"Paste a PGN here…\n\n1. e4 e5 2. Nf3 Nc6 …"}
                style={{
                    width: "100%",
                    height: 170,
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    borderRadius: var_r("md"),
                    color: "var(--text)",
                    padding: 14,
                    fontSize: 14,
                    resize: "vertical"
                }}
            />

            <label style={{
                display: "block",
                marginTop: 10,
                padding: "11px 12px",
                borderRadius: var_r("md"),
                background: "var(--surface-2)",
                border: "1px dashed var(--line-strong)",
                color: "var(--text-dim)",
                fontSize: 13,
                fontWeight: 700,
                textAlign: "center",
                cursor: "pointer"
            }}>
                Or choose a .pgn file
                <input
                    type="file"
                    accept=".pgn,text/plain"
                    onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) void importPgnFile(file);
                        event.currentTarget.value = "";
                    }}
                    style={{ display: "none" }}
                />
            </label>

            {pgnPreview?.game && <PgnPreviewCard
                game={pgnPreview.game}
                moveCount={pgnPreview.moveCount}
            />}

            {pgnPreview?.error && <p style={{
                color: "var(--text-faint)",
                fontSize: 12.5,
                margin: "10px 2px 0"
            }}>
                {pgnPreview.error}
            </p>}

            <PrimaryButton
                onClick={importPgn}
                disabled={!pgnPreview?.game}
                label="Load game"
            />
        </div>}

        {/* Username + month/year form */}
        {source != "pgn" && <div style={cardStyle}>
            <Label icon={<User size={13} />}>Player Username</Label>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: var_r("md"),
                padding: "0 12px",
                marginBottom: 14
            }}>
                <User size={16} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                <input
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    onKeyDown={event => {
                        if (event.key == "Enter") void fetchGames();
                    }}
                    placeholder="e.g. Hikaru"
                    style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: "var(--text)",
                        padding: "13px 0",
                        fontSize: 15,
                        minWidth: 0
                    }}
                />
            </div>

            <Label icon={<Calendar size={13} />}>Import Range</Label>
            <div style={{
                display: "flex",
                gap: 6,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: var_r("md"),
                padding: 4,
                marginBottom: 12
            }}>
                {(["recent", "month"] as FetchMode[]).map(mode => {
                    const active = fetchMode == mode;
                    return <button
                        key={mode}
                        onClick={() => setFetchMode(mode)}
                        style={{
                            flex: 1,
                            padding: "8px 0",
                            borderRadius: var_r("sm"),
                            background: active ? "var(--surface-3)" : "transparent",
                            color: active ? "var(--text)" : "var(--text-faint)",
                            fontWeight: 800,
                            fontSize: 13
                        }}
                    >
                        {mode == "recent" ? "Recent 50" : "Pick month"}
                    </button>;
                })}
            </div>

            {fetchMode == "month" && <>
                <Label icon={<Calendar size={13} />}>Month &amp; Year</Label>
                <div style={{ display: "flex", gap: 8 }}>
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
            </>}

            <PrimaryButton
                onClick={() => void fetchGames()}
                disabled={loading || !username.trim()}
                label={loading ? "Finding games…" : "Find games"}
                loading={loading}
            />
        </div>}

        {/* skeletons */}
        {loading && <div style={{ marginTop: 18 }}>
            {[0, 1, 2, 3].map(index => <div
                key={index}
                className="skeleton"
                style={{ height: 70, marginBottom: 8 }}
            />)}
        </div>}

        {/* Recent Games */}
        {source != "pgn" && !loading && games.length > 0 && <>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                margin: "24px 2px 12px"
            }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                    Recent Games
                </h2>
                <span style={{
                    color: "var(--accent)",
                    fontSize: 12,
                    fontWeight: 700
                }}>
                    Showing {Math.min(visibleCount, games.length)} of {games.length}
                </span>
            </div>

            {games.slice(0, visibleCount).map((game, index) => (
                <GameCard
                    key={index}
                    game={game}
                    username={username}
                    onClick={() => useAppStore.getState().loadGame(game)}
                />
            ))}

            {visibleCount < games.length && <button
                onClick={() => setVisibleCount(count => count + PAGE)}
                style={{
                    width: "100%",
                    marginTop: 6,
                    padding: "13px 0",
                    borderRadius: var_r("md"),
                    background: "var(--surface-1)",
                    border: "1px solid var(--line)",
                    color: "var(--text-dim)",
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: "0.04em"
                }}
            >
                LOAD MORE
            </button>}
        </>}

        {error && <p style={{
            color: "#ff8a84",
            fontSize: 13,
            marginTop: 14
        }}>
            {error}
        </p>}

        {/* privacy footer fills empty space on the PGN tab */}
        {games.length == 0 && !loading && <div style={{
            marginTop: 40,
            textAlign: "center",
            color: "var(--text-faint)",
            fontSize: 12,
            lineHeight: 1.6
        }}>
            <div style={{ fontSize: 18, marginBottom: 6, opacity: 0.6 }}>🔒</div>
            Fully on-device · No account · No tracking<br />
            Your games never leave your phone.
        </div>}
    </div>;
}

function PgnPreviewCard(props: { game: Game; moveCount: number }) {
    const { game } = props;
    const result = game.players.white.result == GameResult.WIN
        ? "1-0"
        : game.players.black.result == GameResult.WIN
            ? "0-1"
            : game.players.white.result == GameResult.DRAW ? "½-½" : "*";

    return <div style={{
        marginTop: 12,
        padding: "12px 13px",
        borderRadius: var_r("md"),
        background: "var(--surface-2)",
        border: "1px solid var(--line)"
    }}>
        <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            fontWeight: 800,
            fontSize: 14
        }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {game.players.white.username || "White"}
            </span>
            <span style={{ color: "var(--text-faint)", flexShrink: 0 }}>vs</span>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {game.players.black.username || "Black"}
            </span>
        </div>
        <div style={{
            marginTop: 7,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            color: "var(--text-dim)",
            fontSize: 12
        }}>
            <span>{result}</span>
            <span>·</span>
            <span>{props.moveCount || "—"} move{props.moveCount == 1 ? "" : "s"}</span>
            {game.date && <><span>·</span><span>{new Date(game.date).toLocaleDateString()}</span></>}
            <span>·</span>
            <span>{game.variant}</span>
        </div>
    </div>;
}

function GameCard(props: {
    game: Game;
    username: string;
    onClick: () => void;
}) {
    const { game } = props;

    const isWhite = game.players.white.username?.toLowerCase()
        == props.username.trim().toLowerCase();

    // The opponent is whoever isn't the searched user (fallback: black).
    const me = isWhite ? game.players.white : game.players.black;
    const opponent = isWhite ? game.players.black : game.players.white;
    const myResult = me.result;

    const opponentName = opponent.username || "Opponent";
    const initial = opponentName.charAt(0).toUpperCase();

    return <button
        onClick={props.onClick}
        style={{
            width: "100%",
            textAlign: "left",
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            borderRadius: var_r("md"),
            padding: "12px 14px",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 12
        }}
    >
        {/* avatar */}
        <div style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "var(--surface-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 16,
            color: "var(--text-dim)",
            flexShrink: 0
        }}>
            {initial}
        </div>

        {/* name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                fontWeight: 800,
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
            }}>
                {opponentName}
                {opponent.rating && <span style={{
                    color: "var(--text-faint)",
                    fontWeight: 600,
                    fontSize: 12,
                    marginLeft: 6
                }}>
                    ● {opponent.rating}
                </span>}
            </div>
            <div style={{
                color: "var(--text-faint)",
                fontSize: 12,
                marginTop: 3
            }}>
                {game.timeControl || "—"}
                {game.date && " · " + new Date(game.date).toLocaleDateString()}
            </div>
        </div>

        {/* result pill */}
        <span style={{
            flexShrink: 0,
            padding: "5px 12px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
            background: myResult == GameResult.WIN
                ? "var(--accent-soft)"
                : myResult == GameResult.LOSE
                    ? "rgba(255,69,58,0.16)"
                    : "var(--surface-2)",
            color: resultColours[myResult]
        }}>
            {resultLabels[myResult]}
        </span>
    </button>;
}

function Label(props: { icon?: React.ReactNode; children: React.ReactNode }) {
    return <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: "var(--text-dim)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.03em",
        marginBottom: 8
    }}>
        {props.icon}
        {props.children}
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
            marginTop: 16,
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
            ? <Loader2 size={17} style={{ animation: "spin 0.9s linear infinite" }} />
            : null}
        {props.label}
        {!props.loading && enabled && <ArrowRight size={17} />}
    </button>;
}

const cardStyle: React.CSSProperties = {
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg)",
    padding: 16
};

const selectStyle: React.CSSProperties = {
    flex: 1,
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-md)",
    color: "var(--text)",
    padding: "12px 10px",
    fontSize: 14
};

function var_r(size: "sm" | "md" | "lg") {
    return `var(--r-${size})`;
}

export default HomeScreen;
