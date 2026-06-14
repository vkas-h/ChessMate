<div align="center">

# ♞ ChessMate

**A clean, offline-first chess game analysis app — powered by Stockfish 17 (WASM)**

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

</div>

---

ChessMate is a **privacy-first chess analysis tool** that runs entirely in your browser. No accounts. No servers. No ads. Just chess — analysed locally using Stockfish 17 compiled to WebAssembly.

Import your games from Chess.com or Lichess, or paste any PGN, and get instant move-by-move analysis with accuracy scores and move classifications — all saved on your device.

---

## ✨ Features

| Feature | Detail |
|---|---|
| 🤖 **Stockfish 17 (WASM)** | Engine runs fully in-browser — no server needed |
| 🏷️ **Move Classifications** | Brilliant · Critical · Best · Excellent · Okay · Inaccuracy · Mistake · Blunder · Theory · Forced |
| 📊 **Accuracy %** | Per-player accuracy + full game report |
| 📥 **Flexible Import** | Chess.com username · Lichess username · Raw PGN |
| 📚 **Local Library** | Saved analyses stored in IndexedDB — your data stays on your device |
| 📱 **PWA + Android** | Installable as a Progressive Web App; wrappable as a native Android/iOS app via Capacitor |
| 🔒 **Zero Tracking** | No accounts · No sign-in · No CAPTCHA · No ads · No analytics |
| 🌙 **Dark UI** | Sleek dark theme optimised for mobile |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm v9+

### Install & Run

```sh
git clone https://github.com/vkas-h/ChessMate.git
cd ChessMate
npm install
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`). To access from your phone on the same Wi-Fi:

```sh
npm run dev -- --host
```

### Build for Production

```sh
npm run build      # type-checks + bundles → dist/
npm run preview    # serve the production build locally
```

---

## 📱 Android / iOS App (Capacitor)

ChessMate is a standard Vite SPA and can be wrapped into a native app using [Capacitor](https://capacitorjs.com/):

```sh
npm run build
npm run android:sync   # builds + syncs to the Android project
npm run android:open   # opens Android Studio — build & run from there
```

For iOS, replace the `android` commands with `ios` (requires Xcode on macOS).

---

## 🗂️ Project Structure

```
chessmate/
├── public/
│   ├── engines/          Stockfish 17 lite (WASM, ~7 MB, single-threaded)
│   ├── img/              classification badges + piece images
│   ├── audio/            move / capture / check sounds
│   └── manifest.webmanifest  PWA manifest
│
└── src/
    ├── core/             ⭐ WintrChess analysis core (unmodified logic)
    │   ├── lib/reporter/     move classification engine
    │   ├── lib/stateTree/    PGN ↔ move tree
    │   ├── resources/        openings database
    │   └── types/, constants/
    │
    ├── engine/
    │   ├── Engine.ts         UCI wrapper around the Stockfish worker
    │   ├── analyse.ts        evaluate-all-moves → classify pipeline
    │   ├── accuracy.ts       per-player accuracy calculation
    │   ├── realtime.ts       live eval during board exploration
    │   └── presets.ts        engine depth / multipv presets
    │
    ├── lib/
    │   ├── importers.ts      PGN / Chess.com / Lichess importers
    │   ├── library.ts        on-device game storage (IndexedDB)
    │   ├── classifications.ts  colours / icons / labels
    │   └── sounds.ts         board sounds
    │
    ├── screens/
    │   ├── HomeScreen.tsx    game import UI
    │   ├── AnalysisScreen.tsx board + report view
    │   └── LibraryScreen.tsx  saved games library
    │
    ├── components/
    │   ├── NavBar.tsx
    │   ├── EvalBar.tsx
    │   ├── EvalGraph.tsx
    │   ├── EngineLines.tsx
    │   ├── MoveStrip.tsx
    │   ├── ReportSummary.tsx
    │   ├── ShareDialog.tsx
    │   └── Splash.tsx
    │
    ├── store.ts          global app state (Zustand)
    └── App.tsx, main.tsx, index.css
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) |
| Build tool | [Vite 5](https://vitejs.dev/) |
| Chess engine | [Stockfish 17](https://stockfishchess.org/) (WASM, single-threaded) |
| Chess logic | [chess.js](https://github.com/jhlywa/chess.js) |
| Board UI | [react-chessboard](https://github.com/Clariity/react-chessboard) |
| State | [Zustand](https://github.com/pmndrs/zustand) |
| Storage | [idb-keyval](https://github.com/jakearchibald/idb-keyval) (IndexedDB) |
| PGN parsing | [@mliebelt/pgn-parser](https://github.com/mliebelt/pgn-parser) |
| Mobile | [Capacitor 8](https://capacitorjs.com/) (Android / iOS) |
| Validation | [Zod 4](https://zod.dev/) |

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- 🐛 [Open an issue](https://github.com/vkas-h/ChessMate/issues) for bugs or feature requests
- 🔀 Fork the repo and submit a pull request
- ⭐ Star the repo if you find it useful

Please keep pull requests focused — one feature or fix per PR.

---

## ⚖️ License

This project contains code derived from [WintrChess](https://github.com/wintrcat/wintrchess) (GPL-3.0).  
As required by that license, **ChessMate is also distributed under [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0)**.

See the [LICENSE](LICENSE) file for full details.

---

<div align="center">

Made with ♟️ — vkas-h

</div>
