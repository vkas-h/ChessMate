import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            // App is meant to work offline; precache the shell AND the
            // heavy engine assets so a cold offline launch still runs
            // Stockfish locally.
            includeAssets: [
                "icon-192.png",
                "icon-512.png",
                "icon-maskable-512.png",
                "logo-knight.png",
                "img/**/*",
                "audio/**/*"
            ],
            workbox: {
                // ~7 MB WASM engine — raise the precache size limit.
                maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
                globPatterns: [
                    "**/*.{js,css,html,wasm,png,svg,webp,mp3,json,webmanifest}"
                ],
                // Lichess / Chess.com APIs: network-first so imports and
                // cloud evals stay fresh but still work flaky-offline.
                runtimeCaching: [
                    {
                        urlPattern: ({ url }) =>
                            url.hostname.endsWith("lichess.org")
                            || url.hostname.endsWith("chess.com"),
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "chess-apis",
                            networkTimeoutSeconds: 6,
                            expiration: {
                                maxEntries: 200,
                                maxAgeSeconds: 60 * 60 * 24 * 7
                            }
                        }
                    }
                ]
            },
            manifest: {
                name: "ChessMate — Game Analysis",
                short_name: "ChessMate",
                description:
                    "Free chess game analysis with move classifications, "
                    + "fully on-device.",
                start_url: "/",
                display: "standalone",
                background_color: "#0e0e0f",
                theme_color: "#0e0e0f",
                orientation: "portrait",
                icons: [
                    {
                        src: "/icon-192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any"
                    },
                    {
                        src: "/icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any"
                    },
                    {
                        src: "/icon-maskable-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable"
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src/core")
        }
    },
    build: {
        target: "es2022",
        chunkSizeWarningLimit: 1500
    }
});
