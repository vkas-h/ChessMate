import React, { useState } from "react";

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

    // Cold-start only: App mounts once per page load; tab switches
    // don't remount it, so the splash never replays in-session.
    const [splashDone, setSplashDone] = useState(false);

    // Insights is a full-screen drill-down from Library. All main tabs,
    // including Settings, keep the tab bar visible so there is no floating
    // gear overlapping headers/board content.
    const showTabs = screen != "stats";

    // Avoid covering the fixed Analysis move controls. Update prompts stay
    // on low-risk browsing screens and are also available from Settings.
    const showUpdateBanner = splashDone
        && (screen == "home" || screen == "library");

    return <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        maxWidth: 560,
        margin: "0 auto",
        position: "relative"
    }}>
        <div
            key={screen}
            className="screen-fade app-scroll"
            style={{
                flex: 1,
                overflowY: "auto",
                paddingBottom: showTabs
                    ? "calc(var(--nav-height) + env(safe-area-inset-bottom))"
                    : "env(safe-area-inset-bottom)"
            }}
        >
            {screen == "home" && <HomeScreen />}
            {screen == "analysis" && <AnalysisScreen />}
            {screen == "library" && <LibraryScreen />}
            {screen == "settings" && <SettingsScreen />}
            {screen == "stats" && <StatsScreen />}
        </div>

        {showTabs && <NavBar />}

        {showUpdateBanner && <UpdateBanner />}

        {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
    </div>;
}

export default App;
