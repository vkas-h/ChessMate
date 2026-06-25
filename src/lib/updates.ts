/**
 * Checks GitHub Releases for a newer version of ChessMate and exposes
 * a simple "update available" result. The current version is compared
 * against the latest release tag (e.g. "v1.2.0" / "1.2").
 *
 * Web/PWA: we can only LINK to the release page. In the native APK the
 * download/install step would be added later via a native plugin.
 */

const REPO = "vkas-h/ChessMate";
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

/** Bump this with each release (keep in sync with the app version). */
export const CURRENT_VERSION = "1.1.0";

const LAST_CHECK_KEY = "chessmate:update:lastCheck";
const DISMISSED_KEY = "chessmate:update:dismissed";
/** Only hit the API at most once every 6h. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface UpdateInfo {
    version: string;
    name: string;
    notes: string;
    url: string;
    /** direct .apk asset, if the release has one */
    apkUrl?: string;
}

/** Parse "v1.2.3" / "1.2" -> [1,2,3]. Non-numerics ignored. */
function parseVersion(raw: string): number[] {
    return raw.replace(/^v/i, "").split(/[.\-+]/)
        .map(p => parseInt(p, 10))
        .filter(n => !isNaN(n));
}

/** true if `a` is strictly newer than `b`. */
export function isNewer(a: string, b: string): boolean {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const x = pa[i] || 0;
        const y = pb[i] || 0;
        if (x != y) return x > y;
    }
    return false;
}

/**
 * Fetch the latest release and return UpdateInfo if it's newer than the
 * installed version, else null. Rate-limited via localStorage unless
 * `force` is set (e.g. a manual "Check now" tap).
 */
export async function checkForUpdate(
    force = false
): Promise<UpdateInfo | null> {
    if (!force) {
        try {
            const last = Number(localStorage.getItem(LAST_CHECK_KEY) || "0");
            if (Date.now() - last < CHECK_INTERVAL_MS) {
                // within cool-down; skip the network call
                return null;
            }
        } catch { /* ignore */ }
    }

    let data: any;
    try {
        const res = await fetch(LATEST_URL, {
            headers: { Accept: "application/vnd.github+json" }
        });
        if (!res.ok) return null;
        data = await res.json();
    } catch {
        return null; // offline / rate-limited / no releases
    }

    try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); }
    catch { /* ignore */ }

    const tag: string = data.tag_name || data.name || "";
    if (!tag || !isNewer(tag, CURRENT_VERSION)) return null;

    const apkAsset = (data.assets || []).find(
        (a: any) => typeof a.name == "string"
            && a.name.toLowerCase().endsWith(".apk")
    );

    return {
        version: tag,
        name: data.name || tag,
        notes: data.body || "",
        url: data.html_url || `https://github.com/${REPO}/releases/latest`,
        apkUrl: apkAsset?.browser_download_url
    };
}

/** Remember that the user dismissed this version's banner. */
export function dismissUpdate(version: string) {
    try { localStorage.setItem(DISMISSED_KEY, version); } catch { /* ignore */ }
}

export function isDismissed(version: string): boolean {
    try { return localStorage.getItem(DISMISSED_KEY) == version; }
    catch { return false; }
}
