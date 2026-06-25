import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import {
    checkForUpdate, dismissUpdate, isDismissed, UpdateInfo
} from "../lib/updates";
import { getToggle } from "../lib/settings";

/**
 * App-wide "update available" banner. Checks GitHub Releases on mount
 * (rate-limited, and only if the user hasn't disabled update checks),
 * and shows a dismissible bar. Tapping it opens the release page
 * (where the APK can be downloaded).
 */
function UpdateBanner() {
    const [info, setInfo] = useState<UpdateInfo | null>(null);

    useEffect(() => {
        if (!getToggle("checkUpdates")) return;

        let cancelled = false;
        (async () => {
            const update = await checkForUpdate();
            if (cancelled || !update) return;
            if (isDismissed(update.version)) return;
            setInfo(update);
        })();

        return () => { cancelled = true; };
    }, []);

    if (!info) return null;

    function dismiss() {
        if (info) dismissUpdate(info.version);
        setInfo(null);
    }

    return <div style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(var(--nav-height) + env(safe-area-inset-bottom) + 10px)",
        width: "calc(100% - 24px)",
        maxWidth: 536,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 12px",
        borderRadius: "var(--r-md)",
        background: "var(--accent)",
        color: "var(--accent-text)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.45)"
    }}>
        <Download size={18} style={{ flexShrink: 0 }} />
        <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                flex: 1,
                minWidth: 0,
                color: "inherit",
                textDecoration: "none"
            }}
        >
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                Update available · {info.version}
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.85 }}>
                Tap to download the latest version
            </div>
        </a>
        <button
            onClick={dismiss}
            aria-label="Dismiss update"
            style={{
                flexShrink: 0,
                display: "flex",
                color: "inherit",
                opacity: 0.85,
                padding: 4
            }}
        >
            <X size={16} />
        </button>
    </div>;
}

export default UpdateBanner;
