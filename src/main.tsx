import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { initHistorySync } from "./store";
import "./index.css";

initHistorySync();

// Inside the Capacitor APK the WebView draws edge-to-edge under the
// Android status bar; flag it so CSS adds safe-area padding.
if ((window as any).Capacitor?.isNativePlatform?.()) {
    document.documentElement.classList.add("native-app");
}

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
