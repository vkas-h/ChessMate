import React, { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";

import { useAppStore } from "./store";
import HomeScreen from "./screens/HomeScreen";
import AnalysisScreen from "./screens/AnalysisScreen";
import LibraryScreen from "./screens/LibraryScreen";
import SettingsScreen from "./screens/SettingsScreen";
import StatsScreen from "./screens/StatsScreen";
import NavBar from "./components/NavBar";
import Splash from "./components/Splash";
import UpdateBanner from "./components/UpdateBanner";

function App() {
    const screen = useAppStore(state => state.screen);
    const setScreen = useAppStore(state => state.setScreen);

    // Cold-start only: App mounts once per page load; tab switches
    // don't remount it, so the splash never replays in-session.
    const [splashDone, setSplashDone] = useState(false);

    // Gear shows on the main tabs; hidden on full-screen sub-pages.
    const showGear = screen != "settings" && screen != "stats";

    return <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        maxWidth: 560,
        margin: "0 auto",
        position: "relative"
    }}>
        {showGear && <button
            onClick={() => setScreen("settings")}
            aria-label="Settings"
            className="settings-gear"
            style={{
                position: "fixed",
                top: "max(env(safe-area-inset-top), 10px)",
                right: 12,
                zIndex: 60,
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(36,36,37,0.7)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                border: "1px solid var(--line)",
                color: "var(--text-dim)"
            }}
        >
            <SettingsIcon size={19} />
        </button>}

        <div
            key={screen}
            className="screen-fade app-scroll"
            style={{
                flex: 1,
                overflowY: "auto",
                paddingBottom:
                    "calc(var(--nav-height) + env(safe-area-inset-bottom))"
            }}
        >
            {screen == "home" && <HomeScreen />}
            {screen == "analysis" && <AnalysisScreen />}
            {screen == "library" && <LibraryScreen />}
            {screen == "settings" && <SettingsScreen />}
            {screen == "stats" && <StatsScreen />}
        </div>

        {screen != "settings" && screen != "stats" && <NavBar />}

        {screen != "settings" && screen != "stats" && splashDone
            && <UpdateBanner />}

        {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
    </div>;
}

export default App;
