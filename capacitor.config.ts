import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "com.vkas.chessmate",
    appName: "ChessMate",
    webDir: "dist",

    android: {
        // Renders behind status bar nicely with our dark theme
        backgroundColor: "#101014"
    },

    plugins: {
        SplashScreen: {
            // Native splash: plain dark, hands over to our animated
            // web splash as soon as the WebView is ready.
            backgroundColor: "#101014",
            launchShowDuration: 0,
            launchAutoHide: true,
            showSpinner: false
        }
    }
};

export default config;
