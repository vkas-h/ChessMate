import React, { useEffect, useRef, useState } from "react";
import {
    User, Zap, Volume2,
    Trash2, Code2, Heart, Save, RefreshCw
} from "lucide-react";

import {
    getUsername, setUsername as persistUsername,
    getToggle, setToggle, ToggleKey, Platform
} from "../lib/settings";
import {
    AnalysisPreset, presets, loadPreset, savePreset
} from "../engine/presets";
import { clearEvalCache, getEvalCacheStats } from "../engine/evalCache";
import {
    clearLibrary,
    exportLibrary,
    getLibraryStats,
    importLibrary,
    LibraryBackup
} from "../lib/library";
import { checkForUpdate } from "../lib/updates";

const APP_VERSION = __APP_VERSION__.replace(/\.0$/, "");

function SettingsScreen() {
    const importInputRef = useRef<HTMLInputElement | null>(null);

    const [ccUser, setCcUser] = useState(getUsername("chesscom"));
    const [liUser, setLiUser] = useState(getUsername("lichess"));
    const [preset, setPreset] = useState<AnalysisPreset>(loadPreset);
    const [cacheCleared, setCacheCleared] = useState(false);
    const [libraryCleared, setLibraryCleared] = useState(false);
    const [confirmClearLibrary, setConfirmClearLibrary] = useState(false);
    const [cacheEntries, setCacheEntries] = useState<number | null>(null);
    const [savedGames, setSavedGames] = useState<number | null>(null);
    const [backupMsg, setBackupMsg] = useState("");
    const [updateMsg, setUpdateMsg] = useState("");

    async function refreshStorageStats() {
        const [cache, library] = await Promise.all([
            getEvalCacheStats(),
            getLibraryStats()
        ]);
        setCacheEntries(cache.entries);
        setSavedGames(library.games);
    }

    useEffect(() => {
        void refreshStorageStats();
    }, []);

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
        await refreshStorageStats();
        setCacheCleared(true);
        setTimeout(() => setCacheCleared(false), 2000);
    }

    async function onClearLibrary() {
        if (!confirmClearLibrary) {
            setConfirmClearLibrary(true);
            setTimeout(() => setConfirmClearLibrary(false), 3500);
            return;
        }

        await clearLibrary();
        await refreshStorageStats();
        setConfirmClearLibrary(false);
        setLibraryCleared(true);
        setTimeout(() => setLibraryCleared(false), 2000);
    }

    async function onExportLibrary() {
        const backup = await exportLibrary();
        if (backup.records.length == 0) {
            setBackupMsg("No saved games to export.");
            setTimeout(() => setBackupMsg(""), 2500);
            return;
        }

        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `chessmate-library-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);

        setBackupMsg(`Exported ${backup.records.length} game${backup.records.length == 1 ? "" : "s"}.`);
        setTimeout(() => setBackupMsg(""), 2500);
    }

    async function onImportLibrary(file: File) {
        try {
            const backup = JSON.parse(await file.text()) as LibraryBackup;
            const count = await importLibrary(backup);
            await refreshStorageStats();
            setBackupMsg(`Imported ${count} game${count == 1 ? "" : "s"}.`);
        } catch (err) {
            setBackupMsg(
                err instanceof Error ? err.message : "Could not import backup."
            );
        }
        setTimeout(() => setBackupMsg(""), 3000);
    }

    return <div style={{ padding: "16px 16px 96px" }}>
        {/* header */}
        <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18
        }}>
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

        </Section>

        {/* Storage */}
        <Section title="STORAGE" icon={<Trash2 size={14} />}>
            <Row
                label="Saved games"
                value={savedGames == null ? "Loading…" : String(savedGames)}
            />
            <Row
                label="Evaluation cache"
                value={cacheEntries == null
                    ? "Loading…"
                    : `${cacheEntries} position${cacheEntries == 1 ? "" : "s"}`}
            />

            <button
                onClick={() => void onExportLibrary()}
                style={neutralButtonStyle}
            >
                <Save size={15} />
                Export saved games
            </button>

            <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                style={neutralButtonStyle}
            >
                <Save size={15} />
                Import saved games
            </button>
            <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void onImportLibrary(file);
                    event.currentTarget.value = "";
                }}
                style={{ display: "none" }}
            />

            {backupMsg && <Hint>{backupMsg}</Hint>}

            <button
                onClick={() => void onClearCache()}
                style={dangerButtonStyle(cacheCleared)}
            >
                <Trash2 size={15} />
                {cacheCleared ? "Cache cleared" : "Clear evaluation cache"}
            </button>

            <button
                onClick={() => void onClearLibrary()}
                style={{
                    ...dangerButtonStyle(libraryCleared || confirmClearLibrary),
                    color: libraryCleared
                        ? "var(--good)"
                        : confirmClearLibrary ? "var(--bad)" : "var(--text-dim)"
                }}
            >
                <Trash2 size={15} />
                {libraryCleared
                    ? "Library cleared"
                    : confirmClearLibrary
                        ? "Tap again to delete all saved games"
                        : "Clear saved games"}
            </button>
            <Hint>
                Clearing the evaluation cache only removes reusable engine
                results. Clearing saved games permanently deletes your library
                from this device.
            </Hint>
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

const neutralButtonStyle: React.CSSProperties = {
    width: "100%",
    marginTop: 10,
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
    gap: 8,
    cursor: "pointer"
};

function dangerButtonStyle(success = false): React.CSSProperties {
    return {
        width: "100%",
        marginTop: 10,
        padding: "11px 0",
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        color: success ? "var(--good)" : "var(--text-dim)",
        fontWeight: 700,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8
    };
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
