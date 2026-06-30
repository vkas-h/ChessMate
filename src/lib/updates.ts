/**
 * Checks GitHub Releases for newer ChessMate versions.
 *
 * The installed version is injected by Vite from package.json as
 * __APP_VERSION__, so Settings/About and update checks share one source
 * of truth.
 */

const REPO = "vkas-h/ChessMate";
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const CURRENT_VERSION = typeof __APP_VERSION__ == "string"
    ? __APP_VERSION__
    : "0.0.0";

const LAST_CHECK_KEY = "chessmate:update:lastCheck";
const LAST_RESULT_KEY = "chessmate:update:lastResult";
const DISMISSED_KEY = "chessmate:update:dismissed";
/** Only hit the API at most once every 6h for automatic checks. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface UpdateInfo {
    version: string;
    name: string;
    notes: string;
    url: string;
    /** direct .apk asset, if the release has one */
    apkUrl?: string;
}

export type UpdateCheckStatus =
    | "available"
    | "current"
    | "offline"
    | "rate_limited"
    | "error";

export interface UpdateCheckResult {
    status: UpdateCheckStatus;
    currentVersion: string;
    latest?: UpdateInfo;
    checkedAt?: number;
    fromCache?: boolean;
    message: string;
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

function readLastCheck(): number {
    try { return Number(localStorage.getItem(LAST_CHECK_KEY) || "0"); }
    catch { return 0; }
}

function writeLastCheck(time: number) {
    try { localStorage.setItem(LAST_CHECK_KEY, String(time)); }
    catch { /* ignore */ }
}

function readLastResult(): UpdateCheckResult | null {
    try {
        const raw = localStorage.getItem(LAST_RESULT_KEY);
        return raw ? JSON.parse(raw) as UpdateCheckResult : null;
    } catch {
        return null;
    }
}

function writeLastResult(result: UpdateCheckResult) {
    try { localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result)); }
    catch { /* ignore */ }
}

function releaseToUpdateInfo(data: any): UpdateInfo {
    const tag: string = data.tag_name || data.name || "";
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

function formatVersion(version: string): string {
    return version.replace(/^v/i, "v").replace(/\.0$/, "");
}

/**
 * Rich update check for Settings. Returns the difference between
 * up-to-date, update available, offline/rate-limit/error.
 */
export async function checkUpdateStatus(
    force = false
): Promise<UpdateCheckResult> {
    const now = Date.now();

    if (!force) {
        const last = readLastCheck();
        if (now - last < CHECK_INTERVAL_MS) {
            const cached = readLastResult();
            if (cached) return { ...cached, fromCache: true };
        }
    }

    try {
        const res = await fetch(LATEST_URL, {
            headers: { Accept: "application/vnd.github+json" }
        });

        if (!res.ok) {
            const status: UpdateCheckStatus =
                res.status == 403 || res.status == 429
                    ? "rate_limited" : "error";
            const result: UpdateCheckResult = {
                status,
                currentVersion: CURRENT_VERSION,
                checkedAt: now,
                message: status == "rate_limited"
                    ? "GitHub is rate-limiting update checks. Try again later."
                    : `Could not check updates (${res.status}).`
            };
            writeLastCheck(now);
            writeLastResult(result);
            return result;
        }

        const latest = releaseToUpdateInfo(await res.json());
        const result: UpdateCheckResult = latest.version
            && isNewer(latest.version, CURRENT_VERSION)
            ? {
                status: "available",
                currentVersion: CURRENT_VERSION,
                latest,
                checkedAt: now,
                message: `Update available: ${formatVersion(latest.version)}`
            }
            : {
                status: "current",
                currentVersion: CURRENT_VERSION,
                latest,
                checkedAt: now,
                message: "You're up to date."
            };

        writeLastCheck(now);
        writeLastResult(result);
        return result;
    } catch {
        const offline = typeof navigator != "undefined" && !navigator.onLine;
        return {
            status: offline ? "offline" : "error",
            currentVersion: CURRENT_VERSION,
            message: offline
                ? "You're offline. Connect to the internet and try again."
                : "Could not check updates. Try again later."
        };
    }
}

/**
 * Backwards-compatible helper used by the app-wide banner.
 * Returns UpdateInfo only when a newer release is available.
 */
export async function checkForUpdate(
    force = false
): Promise<UpdateInfo | null> {
    const result = await checkUpdateStatus(force);
    return result.status == "available" ? result.latest || null : null;
}

/** Remember that the user dismissed this version's banner. */
export function dismissUpdate(version: string) {
    try { localStorage.setItem(DISMISSED_KEY, version); } catch { /* ignore */ }
}

export function isDismissed(version: string): boolean {
    try { return localStorage.getItem(DISMISSED_KEY) == version; }
    catch { return false; }
}
