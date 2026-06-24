import React, { useEffect, useState } from "react";

/**
 * Cold-start splash. Plays once per app launch (component mounts on
 * page load only - tab switches never remount App). Skippable on tap.
 *
 * Timeline:
 *   0.00s  knight tile fades/scales in
 *   0.35s  "ChessMate" rises under it
 *   0.70s  "crafted by VKAS" fades in at the bottom
 *   1.45s  whole overlay fades out, then unmounts
 */
function Splash(props: { onDone: () => void }) {
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        const leaveTimer = setTimeout(() => setLeaving(true), 1450);
        return () => clearTimeout(leaveTimer);
    }, []);

    useEffect(() => {
        if (!leaving) return;

        const doneTimer = setTimeout(props.onDone, 380);
        return () => clearTimeout(doneTimer);
    }, [leaving]);

    return <div
        onClick={() => setLeaving(true)}
        style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: leaving ? 0 : 1,
            transition: "opacity 0.38s var(--ease)",
            pointerEvents: leaving ? "none" : "auto"
        }}
    >
        {/* knight tile */}
        <div style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 40px rgba(0, 0, 0, 0.5)",
            animation: "splashTile 0.5s var(--ease) both"
        }}>
            <img
                src="/logo-knight.png"
                alt="ChessMate"
                style={{ width: 60, height: 60 }}
            />
        </div>

        {/* app name */}
        <div style={{
            marginTop: 18,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            animation: "splashRise 0.5s var(--ease) 0.35s both"
        }}>
            ChessMate
        </div>

        <div style={{
            marginTop: 4,
            fontSize: 13,
            color: "var(--text-dim)",
            animation: "splashRise 0.5s var(--ease) 0.45s both"
        }}>
            On-device game analysis
        </div>

        {/* maker's mark */}
        <div style={{
            position: "absolute",
            bottom: "calc(40px + env(safe-area-inset-bottom))",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "var(--text-faint)",
            animation: "splashFade 0.6s var(--ease) 0.7s both"
        }}>
            CRAFTED BY VKAS
        </div>
    </div>;
}

export default Splash;
