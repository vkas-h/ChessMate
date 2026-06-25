/**
 * App settings persisted in localStorage. Centralised so every screen
 * reads/writes the same keys. Usernames live under their own keys
 * (shared with HomeScreen) for backwards-compat.
 */

const USERNAME_KEY = {
    chesscom: "chessmate:username:chesscom",
    lichess: "chessmate:username:lichess"
} as const;

export type Platform = "chesscom" | "lichess";

export function getUsername(platform: Platform): string {
    try {
        return localStorage.getItem(USERNAME_KEY[platform]) || "";
    } catch {
        return "";
    }
}

export function setUsername(platform: Platform, value: string) {
    try {
        localStorage.setItem(USERNAME_KEY[platform], value.trim());
    } catch { /* ignore */ }
}

/* ---- boolean feature toggles ---- */

const TOGGLE_KEY = {
    autoSave: "chessmate:setting:autoSave",
    autoAnalyze: "chessmate:setting:autoAnalyze",
    checkUpdates: "chessmate:setting:checkUpdates",
    notifications: "chessmate:setting:notifications",
    sounds: "chessmate:setting:sounds"
} as const;

export type ToggleKey = keyof typeof TOGGLE_KEY;

const TOGGLE_DEFAULTS: Record<ToggleKey, boolean> = {
    autoSave: false,
    autoAnalyze: false,
    checkUpdates: true,
    notifications: true,
    sounds: true
};

export function getToggle(key: ToggleKey): boolean {
    try {
        const stored = localStorage.getItem(TOGGLE_KEY[key]);
        if (stored == null) return TOGGLE_DEFAULTS[key];
        return stored == "1";
    } catch {
        return TOGGLE_DEFAULTS[key];
    }
}

export function setToggle(key: ToggleKey, value: boolean) {
    try {
        localStorage.setItem(TOGGLE_KEY[key], value ? "1" : "0");
    } catch { /* ignore */ }
}
