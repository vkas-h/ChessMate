# ♞ ChessMate

A clean, mobile-first **chess game analysis app** — built on the open-source
WintrChess analysis core (GPL-3.0), with everything you don't need removed:

- ❌ No accounts, no sign-in
- ❌ No CAPTCHA — ever
- ❌ No news, banners, ads or popups
- ❌ No server, no database — **everything runs on your device**
- ✅ Stockfish 17 (WASM) analysis in the browser
- ✅ Move classifications: Brilliant / Critical / Best / Excellent / Okay /
  Inaccuracy / Mistake / Blunder / Theory / Forced
- ✅ Accuracy % for both players + game report
- ✅ Import games from **Chess.com**, **Lichess**, or paste a **PGN**
- ✅ Local game library (IndexedDB) — saved analyses stay on your device
- ✅ Installable as a PWA (Add to Home Screen)

## 🚀 Run it

```sh
npm install
npm run dev        # development server
npm run build      # production build → dist/
npm run preview    # serve the production build
```

Open the URL it prints (e.g. http://localhost:5173) — on your phone too,
if you're on the same Wi-Fi (use `npm run dev -- --host`).

## 📱 Make it a real Android/iOS app (Capacitor)

The app is a standard Vite SPA, so wrapping it is simple:

```sh
npm i @capacitor/core @capacitor/cli
npx cap init ChessMate com.example.chessmate --web-dir dist
npm run build
npx cap add android        # needs Android Studio
npx cap sync
npx cap open android       # build & run from Android Studio
```

For iOS replace `android` with `ios` (needs Xcode on a Mac).

## 🗂️ Project structure

```
chessmate/
├── public/
│   ├── engines/          Stockfish 17 lite (WASM, ~7 MB, single-threaded)
│   ├── img/              classification badges + piece images
│   └── audio/            move/capture/check sounds
└── src/
    ├── core/             ⭐ WintrChess analysis core (unmodified logic)
    │   ├── lib/reporter/     move classification engine
    │   ├── lib/stateTree/    PGN ↔ move tree
    │   ├── resources/        openings database
    │   └── types/, constants/
    ├── engine/
    │   ├── Engine.ts         UCI wrapper around the Stockfish worker
    │   └── analyse.ts        evaluate-all-moves → classify pipeline
    ├── lib/
    │   ├── importers.ts      PGN / Chess.com / Lichess importers
    │   ├── library.ts        on-device game storage (IndexedDB)
    │   ├── classifications.ts colours/icons/names
    │   └── sounds.ts         board sounds
    ├── screens/          Home (import), Analysis (board+report), Library
    ├── components/       NavBar, EvalBar, MoveStrip, ReportSummary
    ├── store.ts          app state (zustand)
    └── App.tsx, main.tsx, index.css
```

## ⚖️ License

Contains code derived from [WintrChess](https://github.com/wintrcat/wintrchess)
(GPL-3.0). This project must therefore also be distributed under GPL-3.0.
"# ChessMate" 
