import React, { useState } from "react";

import { useAppStore } from "./store";
import HomeScreen from "./screens/HomeScreen";
import AnalysisScreen from "./screens/AnalysisScreen";
import LibraryScreen from "./screens/LibraryScreen";
import NavBar from "./components/NavBar";
import Splash from "./components/Splash";

function App() {
    const screen = useAppStore(state => state.screen);

    // Cold-start only: App mounts once per page load; tab switches
    // don't remount it, so the splash never replays in-session.
    const [splashDone, setSplashDone] = useState(false);

    return <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        maxWidth: 560,
        margin: "0 auto"
    }}>
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
        </div>

        <NavBar />

        {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
    </div>;
}

export default App;
