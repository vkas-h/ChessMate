import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, BarChart3, TrendingUp } from "lucide-react";

import { useAppStore } from "../store";
import { listGames, loadGame, SavedGameSummary } from "../lib/library";
import {
    computePlayerStats, winRate, WinDrawLoss, PlayerStats
} from "../lib/stats";
import { getUsername } from "../lib/settings";
import { accuracyDescriptor } from "../lib/report";

function StatsScreen() {
    const setScreen = useAppStore(state => state.setScreen);
    const setLoadedAnalysis = useAppStore(state => state.setLoadedAnalysis);

    const [summaries, setSummaries] = useState<SavedGameSummary[]>([]);
    const [loading, setLoading] = useState(true);

    // Which username to compute for. Prefer a saved one; let the user
    // pick if both Chess.com + Lichess are saved.
    const ccUser = getUsername("chesscom");
    const liUser = getUsername("lichess");
    const [username, setUsername] = useState(ccUser || liUser);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setSummaries(await listGames());
            setLoading(false);
        })();
    }, []);

    const stats = useMemo(
        () => computePlayerStats(summaries, username),
        [summaries, username]
    );

    async function openGame(id: string) {
        const record = await loadGame(id);
        if (!record) return;
        setLoadedAnalysis(record.game, record.accuracies);
        useAppStore.getState().setLibraryId(id);
    }

    const usernameOptions = [ccUser, liUser].filter(Boolean) as string[];

    return <div style={{ padding: "16px 16px 96px" }}>
        {/* header */}
        <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 16
        }}>
            <button
                onClick={() => setScreen("library")}
                aria-label="Back"
                style={backBtn}
            >
                <ChevronLeft size={20} />
            </button>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
                Insights
            </h1>
        </div>

        {/* username switcher */}
        {usernameOptions.length > 1 && <div style={{
            display: "flex", gap: 8, marginBottom: 16
        }}>
            {usernameOptions.map(u => {
                const active = u == username;
                return <button
                    key={u}
                    onClick={() => setUsername(u)}
                    style={{
                        flex: 1, padding: "8px 0", borderRadius: "var(--r-sm)",
                        fontWeight: 700, fontSize: 13,
                        background: active ? "var(--accent-soft)" : "var(--surface-1)",
                        border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                        color: active ? "var(--accent)" : "var(--text-dim)"
                    }}
                >
                    {u}
                </button>;
            })}
        </div>}

        {loading && <p style={{ color: "var(--text-dim)" }}>Loading…</p>}

        {!loading && stats.games == 0 && <EmptyState hasUser={!!username} />}

        {!loading && stats.games > 0 && <StatsBody
            stats={stats}
            onOpen={openGame}
        />}
    </div>;
}

function StatsBody(props: {
    stats: PlayerStats;
    onOpen: (id: string) => void;
}) {
    const s = props.stats;
    const acc = accuracyDescriptor(s.avgAccuracy);

    return <>
        {/* headline cards */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <StatCard
                big={`${s.games}`}
                label="GAMES"
            />
            <StatCard
                big={isNaN(winRate(s.overall)) ? "—" : `${winRate(s.overall).toFixed(0)}%`}
                label="SCORE RATE"
                accent
            />
            <StatCard
                big={isNaN(s.avgAccuracy) ? "—" : s.avgAccuracy.toFixed(1)}
                label="AVG ACCURACY"
                sub={isNaN(s.avgAccuracy) ? undefined : acc.label}
                subColour={acc.colour}
            />
        </div>

        {/* overall W/D/L bar */}
        <Card title="RESULTS">
            <WDLBar wdl={s.overall} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <ColourSplit label="As White" wdl={s.asWhite} acc={s.avgAccuracyWhite} light />
                <ColourSplit label="As Black" wdl={s.asBlack} acc={s.avgAccuracyBlack} />
            </div>
        </Card>

        {/* time controls */}
        {s.byTimeControl.length > 0 && <Card title="BY TIME CONTROL">
            {s.byTimeControl.map(tc => <RowBar
                key={tc.name}
                name={tc.name}
                wdl={tc.wdl}
            />)}
        </Card>}

        {/* openings */}
        {s.topOpenings.length > 0 && <Card title="TOP OPENINGS">
            {s.topOpenings.map(op => <RowBar
                key={op.name}
                name={op.name}
                wdl={op.wdl}
                wrap
            />)}
        </Card>}

        {/* best / worst games */}
        {(s.bestAccuracy || s.worstAccuracy) && <Card title="ACCURACY HIGHLIGHTS">
            {s.bestAccuracy && <HighlightRow
                label="Best game"
                value={s.bestAccuracy.value}
                summary={s.bestAccuracy.summary}
                icon={<TrendingUp size={15} />}
                onOpen={props.onOpen}
                good
            />}
            {s.worstAccuracy && s.worstAccuracy.summary.id != s.bestAccuracy?.summary.id && <HighlightRow
                label="Toughest game"
                value={s.worstAccuracy.value}
                summary={s.worstAccuracy.summary}
                onOpen={props.onOpen}
            />}
        </Card>}
    </>;
}

/* ---------- pieces ---------- */

function StatCard(props: {
    big: string; label: string; sub?: string; subColour?: string; accent?: boolean;
}) {
    return <div style={{
        flex: 1,
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        padding: "12px 8px",
        textAlign: "center"
    }}>
        <div style={{
            fontSize: 22, fontWeight: 800, lineHeight: 1.1,
            fontFamily: "ui-monospace, monospace",
            color: props.accent ? "var(--accent)" : "var(--text)"
        }}>
            {props.big}
        </div>
        <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.05em",
            color: "var(--text-faint)", marginTop: 4
        }}>
            {props.label}
        </div>
        {props.sub && <div style={{
            fontSize: 10.5, fontWeight: 800, marginTop: 2, color: props.subColour
        }}>
            {props.sub}
        </div>}
    </div>;
}

function Card(props: { title: string; children: React.ReactNode }) {
    return <div style={{ marginBottom: 12 }}>
        <div style={{
            fontSize: 12, fontWeight: 800, letterSpacing: "0.06em",
            color: "var(--text-dim)", margin: "0 2px 8px",
            display: "flex", alignItems: "center", gap: 7
        }}>
            <BarChart3 size={13} /> {props.title}
        </div>
        <div style={{
            background: "var(--surface-1)", border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)", padding: "14px 14px 10px"
        }}>
            {props.children}
        </div>
    </div>;
}

function WDLBar(props: { wdl: WinDrawLoss }) {
    const { win, draw, loss, total } = props.wdl;
    const pct = (n: number) => total ? (n / total) * 100 : 0;

    return <div>
        <div style={{
            display: "flex", height: 12, borderRadius: 6,
            overflow: "hidden", background: "var(--surface-3)"
        }}>
            <span style={{ width: `${pct(win)}%`, background: "var(--good)" }} />
            <span style={{ width: `${pct(draw)}%`, background: "var(--text-faint)" }} />
            <span style={{ width: `${pct(loss)}%`, background: "var(--bad)" }} />
        </div>
        <div style={{
            display: "flex", justifyContent: "space-between",
            marginTop: 8, fontSize: 12.5, fontWeight: 700
        }}>
            <span style={{ color: "var(--good)" }}>{win}W</span>
            <span style={{ color: "var(--text-dim)" }}>{draw}D</span>
            <span style={{ color: "var(--bad)" }}>{loss}L</span>
        </div>
    </div>;
}

function ColourSplit(props: {
    label: string; wdl: WinDrawLoss; acc: number; light?: boolean;
}) {
    const wr = winRate(props.wdl);
    return <div style={{
        flex: 1,
        background: "var(--surface-2)",
        borderRadius: "var(--r-md)",
        padding: "10px 12px"
    }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)" }}>
            {props.label.toUpperCase()}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
            {isNaN(wr) ? "—" : `${wr.toFixed(0)}%`}
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)" }}>
                {" "}({props.wdl.total})
            </span>
        </div>
        {!isNaN(props.acc) && <div style={{
            fontSize: 11, color: "var(--text-faint)", marginTop: 2
        }}>
            {props.acc.toFixed(1)}% acc
        </div>}
    </div>;
}

function RowBar(props: { name: string; wdl: WinDrawLoss; wrap?: boolean }) {
    const { win, draw, loss, total } = props.wdl;
    const pct = (n: number) => total ? (n / total) * 100 : 0;
    const wr = winRate(props.wdl);

    return <div style={{ padding: "7px 0" }}>
        <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "baseline", gap: 8, marginBottom: 5
        }}>
            <span style={{
                fontSize: 13, fontWeight: 600,
                whiteSpace: props.wrap ? "normal" : "nowrap",
                overflow: "hidden", textOverflow: "ellipsis", minWidth: 0
            }}>
                {props.name}
            </span>
            <span style={{
                fontSize: 12, fontWeight: 700, color: "var(--text-dim)", flexShrink: 0
            }}>
                {isNaN(wr) ? "" : `${wr.toFixed(0)}%`} · {total}
            </span>
        </div>
        <div style={{
            display: "flex", height: 7, borderRadius: 4,
            overflow: "hidden", background: "var(--surface-3)"
        }}>
            <span style={{ width: `${pct(win)}%`, background: "var(--good)" }} />
            <span style={{ width: `${pct(draw)}%`, background: "var(--text-faint)" }} />
            <span style={{ width: `${pct(loss)}%`, background: "var(--bad)" }} />
        </div>
    </div>;
}

function HighlightRow(props: {
    label: string;
    value: number;
    summary: SavedGameSummary;
    icon?: React.ReactNode;
    good?: boolean;
    onOpen: (id: string) => void;
}) {
    const s = props.summary;
    return <button
        onClick={() => props.onOpen(s.id)}
        style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "9px 4px", textAlign: "left"
        }}
    >
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)" }}>
                {props.label.toUpperCase()}
            </div>
            <div style={{
                fontSize: 13.5, fontWeight: 600, marginTop: 2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
            }}>
                {s.white} vs {s.black}
            </div>
        </div>
        <span style={{
            fontWeight: 800, fontSize: 15,
            color: props.good ? "var(--good)" : "var(--text)"
        }}>
            {props.value.toFixed(1)}%
        </span>
    </button>;
}

function EmptyState(props: { hasUser: boolean }) {
    return <div style={{
        textAlign: "center", padding: "56px 20px", color: "var(--text-dim)"
    }}>
        <BarChart3 size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
            No stats yet
        </div>
        <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
            {props.hasUser
                ? "Analyse and save some of your games to build your insights."
                : "Set your username in Settings, then analyse and save your games."}
        </div>
    </div>;
}

const backBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", padding: 8,
    borderRadius: "var(--r-md)", background: "var(--surface-1)",
    border: "1px solid var(--line)", color: "var(--text)"
};

export default StatsScreen;
