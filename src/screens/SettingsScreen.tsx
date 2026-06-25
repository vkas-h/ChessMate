import React, { useEffect, useState } from "react";
import {
    ChevronLeft, User, Zap, Volume2,
    Trash2, Code2, Heart, Save, RefreshCw
} from "lucide-react";

import { useAppStore } from "../store";
import {
    getUsername, setUsername as persistUsername,
    getToggle, setToggle, ToggleKey, Platform
} from "../lib/settings";
import {
    AnalysisPreset, presets, loadPreset, savePreset
} from "../engine/presets";
import { clearEvalCache } from "../engine/evalCache";
import { checkForUpdate } from "../lib/updates";

const APP_VERSION = "1.1";

function SettingsScreen() {
    const setScreen = useAppStore(state => state.setScreen);

    const [ccUser, setCcUser] = useState(getUsername("chesscom"));
    const [liUser, setLiUser] = useState(getUsername("lichess"));
    const [preset, setPreset] = useState<AnalysisPreset>(loadPreset);
    const [cacheCleared, setCacheCleared] = useState(false);
    const [updateMsg, setUpdateMsg] = useState("");

    async function onCheckNow() {
        setUpdateMsg("Checking…");
        const update = await checkForUpdate(true);
        if (update) {
            setUpdateMsg(`Update available: ${update.version}`);
        } else {
            setUpdateMsg("You're up to date");
            setTimeout(() => setUpdateMsg(""), 2500);
        }
    }

    // persist usernames as the user types (debounced-ish: on blur)
    function saveUser(platform: Platform, value: string) {
        persistUsername(platform, value);
    }

    function choosePreset(next: AnalysisPreset) {
        setPreset(next);
        savePreset(next);
    }

    async function onClearCache() {
        await clearEvalCache();
        setCacheCleared(true);
        setTimeout(() => setCacheCleared(false), 2000);
    }

    return <div style={{ padding: "16px 16px 96px" }}>
        {/* header */}
        <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18
        }}>
            <button
                onClick={() => setScreen("home")}
                aria-label="Back"
                style={{
                    display: "flex",
                    alignItems: "center",
                    padding: 8,
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-1)",
                    border: "1px solid var(--line)",
                    color: "var(--text)"
                }}
            >
                <ChevronLeft size={20} />
            </button>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
                Settings
            </h1>
        </div>

        {/* Accounts */}
        <Section title="ACCOUNTS" icon={<User size={14} />}>
            <Field label="Chess.com username">
                <input
                    value={ccUser}
                    onChange={e => setCcUser(e.target.value)}
                    onBlur={() => saveUser("chesscom", ccUser)}
                    placeholder="e.g. Hikaru"
                    style={inputStyle}
                />
            </Field>
            <Field label="Lichess username">
                <input
                    value={liUser}
                    onChange={e => setLiUser(e.target.value)}
                    onBlur={() => saveUser("lichess", liUser)}
                    placeholder="e.g. DrNykterstein"
                    style={inputStyle}
                />
            </Field>
            <Hint>Saved usernames pre-fill the Import screen.</Hint>
        </Section>

        {/* Analysis */}
        <Section title="ANALYSIS" icon={<Zap size={14} />}>
            <Field label="Default depth">
                <div style={{ display: "flex", gap: 6 }}>
                    {(Object.keys(presets) as AnalysisPreset[]).map(id => {
                        const active = preset == id;
                        return <button
                            key={id}
                            onClick={() => choosePreset(id)}
                            style={{
                                flex: 1,
                                padding: "8px 0",
                                borderRadius: "var(--r-sm)",
                                fontWeight: 800,
                                fontSize: 13,
                                background: active
                                    ? "var(--accent-soft)" : "var(--surface-2)",
                                border: active
                                    ? "1px solid var(--accent)"
                                    : "1px solid var(--line)",
                                color: active ? "var(--accent)" : "var(--text-dim)"
                            }}
                        >
                            {presets[id].label}
                        </button>;
                    })}
                </div>
            </Field>

            <ToggleRow
                icon={<Save size={16} />}
                label="Auto-save after analysis"
                sub="Saved games power your Insights"
                settingKey="autoSave"
            />

            <ToggleRow
                icon={<Volume2 size={16} />}
                label="Move sounds"
                settingKey="sounds"
            />

            <button
                onClick={() => void onClearCache()}
                style={{
                    width: "100%",
                    marginTop: 10,
                    padding: "11px 0",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    color: cacheCleared ? "var(--good)" : "var(--text-dim)",
                    fontWeight: 700,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                }}
            >
                <Trash2 size={15} />
                {cacheCleared ? "Cache cleared" : "Clear evaluation cache"}
            </button>
        </Section>

        {/* Updates */}
        <Section title="UPDATES" icon={<RefreshCw size={14} />}>
            <ToggleRow
                icon={<RefreshCw size={16} />}
                label="Check for updates"
                sub="Notify me when a new version is on GitHub"
                settingKey="checkUpdates"
            />
            <button
                onClick={() => void onCheckNow()}
                style={{
                    width: "100%",
                    marginTop: 6,
                    padding: "11px 0",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    color: "var(--text-dim)",
                    fontWeight: 700,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                }}
            >
                <RefreshCw size={15} /> {updateMsg || "Check now"}
            </button>
        </Section>

        {/* About */}
        <Section title="ABOUT" icon={<Heart size={14} />}>
            <Row label="Version" value={`v${APP_VERSION}`} />
            <a
                href="https://github.com/vkas-h/ChessMate"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 2px",
                    color: "var(--text)",
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600
                }}
            >
                <Code2 size={16} style={{ color: "var(--text-dim)" }} />
                Source code
                <span style={{ marginLeft: "auto", color: "var(--text-faint)" }}>
                    github.com/vkas-h
                </span>
            </a>
            <Hint>Fully on-device · No account · No tracking · GPL-3.0</Hint>
        </Section>
    </div>;
}

/* ---------- small building blocks ---------- */

function Section(props: {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return <div style={{ marginBottom: 18 }}>
        <div style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: "var(--text-dim)",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.06em",
            margin: "0 2px 8px"
        }}>
            {props.icon}
            {props.title}
        </div>
        <div style={{
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            padding: "12px 14px"
        }}>
            {props.children}
        </div>
    </div>;
}

function Field(props: { label: string; children: React.ReactNode }) {
    return <div style={{ marginBottom: 12 }}>
        <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-dim)",
            marginBottom: 6
        }}>
            {props.label}
        </div>
        {props.children}
    </div>;
}

function ToggleRow(props: {
    icon: React.ReactNode;
    label: string;
    sub?: string;
    settingKey: ToggleKey;
}) {
    const [on, setOn] = useState(getToggle(props.settingKey));

    function toggle() {
        const next = !on;
        setOn(next);
        setToggle(props.settingKey, next);
    }

    return <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0"
    }}>
        <span style={{ color: "var(--text-dim)", flexShrink: 0 }}>
            {props.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{props.label}</div>
            {props.sub && <div style={{
                fontSize: 11.5,
                color: "var(--text-faint)",
                marginTop: 2
            }}>
                {props.sub}
            </div>}
        </div>
        <button
            onClick={toggle}
            role="switch"
            aria-checked={on}
            aria-label={props.label}
            style={{
                width: 46,
                height: 28,
                borderRadius: 999,
                flexShrink: 0,
                background: on ? "var(--accent)" : "var(--surface-3)",
                position: "relative",
                transition: "background 0.18s var(--ease)"
            }}
        >
            <span style={{
                position: "absolute",
                top: 3,
                left: on ? 21 : 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.18s var(--ease)"
            }} />
        </button>
    </div>;
}

function Row(props: { label: string; value: string }) {
    return <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "12px 2px",
        fontSize: 14
    }}>
        <span style={{ fontWeight: 600 }}>{props.label}</span>
        <span style={{ color: "var(--text-dim)" }}>{props.value}</span>
    </div>;
}

function Hint(props: { children: React.ReactNode }) {
    return <div style={{
        fontSize: 11.5,
        color: "var(--text-faint)",
        marginTop: 6,
        lineHeight: 1.5
    }}>
        {props.children}
    </div>;
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-md)",
    color: "var(--text)",
    padding: "11px 12px",
    fontSize: 15,
    outline: "none"
};

export default SettingsScreen;
