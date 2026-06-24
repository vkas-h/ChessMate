import React from "react";
import { FileInput, Search, Library } from "lucide-react";

import { Screen, useAppStore } from "../store";

const tabs: { id: Screen; label: string; Icon: typeof Search }[] = [
    { id: "home", label: "Import", Icon: FileInput },
    { id: "analysis", label: "Analyse", Icon: Search },
    { id: "library", label: "Library", Icon: Library }
];

function NavBar() {
    const screen = useAppStore(state => state.screen);
    const setScreen = useAppStore(state => state.setScreen);

    return <nav style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 560,
        height: "calc(var(--nav-height) + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "rgba(14, 14, 15, 0.9)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderTop: "1px solid var(--line)",
        display: "flex",
        zIndex: 50
    }}>
        {tabs.map(tab => {
            const active = screen == tab.id;

            return <button
                key={tab.id}
                onClick={() => setScreen(tab.id)}
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    color: active ? "var(--accent)" : "var(--text-faint)",
                    fontWeight: active ? 800 : 600,
                    fontSize: 11,
                    letterSpacing: "0.02em",
                    position: "relative"
                }}
            >
                {/* active indicator pill */}
                <span style={{
                    position: "absolute",
                    top: 0,
                    width: 28,
                    height: 3,
                    borderRadius: "0 0 3px 3px",
                    background: active ? "var(--accent)" : "transparent",
                    transition: "background 0.2s var(--ease)"
                }} />

                <tab.Icon
                    size={21}
                    strokeWidth={active ? 2.4 : 2}
                />
                {tab.label}
            </button>;
        })}
    </nav>;
}

export default NavBar;
