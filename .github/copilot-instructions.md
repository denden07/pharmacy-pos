<!-- .github/copilot-instructions.md - Guidance for AI coding agents working on this repo -->
# Copilot instructions — pharmacy-poc

Purpose: concise, actionable guidance to help an AI agent be productive in this Vue 3 + Vite + Capacitor codebase.

- **Big picture:** This is a single-page Vue 3 application (Vite) with Vuex for state and Vue Router for navigation. A Capacitor Android native project lives in the `android/` directory for mobile builds. The app initializes a client-side IndexedDB layer from `src/db` on startup (`src/main.js` imports `./db`).

- **Where to look first:**
  - `src/main.js` — app bootstrap (registers `store` and `router`, imports `./db` side-effects).
  - `src/db` — data layer (IDB usage and optional sample seed in `db/sampleData.js`).
  - `src/store` — Vuex modules (`customer.js`, `medicines.js`, `sales.js`) define state shape and mutation/action patterns.
  - `src/router/index.js` — route mappings and route-level props (see `/customers/:id/transactions` example).
  - `src/views` and `src/components` — UI is organized into view pages and reusable components; SFCs use `<script setup>`.

- **Architecture notes & why:**
  - The project keeps business logic in Vuex modules and a local IDB-backed `db/` layer to simulate/persist data without a server — expect to add or modify `src/db` when changing persistence.
  - `main.js` intentionally imports `./db` for side-effects (DB open / migrations). When adding seed/test data, the commented `// import './db/sampleData.js'` shows how to enable seeding.

- **Common edits & examples:**
  - Add a new route: update `src/router/index.js` and add a corresponding file in `src/views`.
  - Add domain state: create a Vuex module under `src/store` and register it in `src/store/index.js` (follow existing module patterns).
  - Modify data model / persistence: update `src/db/index.js` and adjust callers in `store` modules and `db/*.js` helpers.

- **Developer workflows (commands):**
  - Local dev: `npm run dev` (uses Vite). The app entry is `index.html` -> `src/main.js`.
  - Build: `npm run build` (Vite build) and `npm run preview` for a local preview of the production build.
  - Capacitor / Android: native project is in `android/`. Use Capacitor CLI and Android Studio for native builds (e.g., `npx cap sync android`, then open `android/` in Android Studio). Only touch native files if confident.

- **Project-specific patterns & conventions:**
  - Side-effect imports at bootstrap: `src/main.js` imports `./db` without an identifier — DB initialization is implicit.
  - State is modular: each domain area has its own Vuex file (e.g., `customer.js`, `medicines.js`) — follow existing action/mutation naming and payload shapes.
  - Routes may use `props` functions for parameter handling — see `TransactionHistory` route which maps `:id` to `customerId` and reads `tab` from query string.

- **Integration points / dependencies to be aware of:**
  - Capacitor plugins in `package.json` (Filesystem, Device, Share, file-picker) — check usage before changing plugin versions.
  - Charts: `apexcharts` and `vue-chartjs` are used in `src/components/analytics`.
  - `idb` is the IndexedDB helper used under `src/db`.

- **What not to change lightly:**
  - Files in the `android/` directory (native Android project) and Gradle files unless you intend to modify native builds.
  - The DB initialization side-effect in `src/main.js` — changing import order may affect startup.

- **Examples to cite in PRs / changes:**
  - When changing routing behavior, reference `src/router/index.js` and the `/customers/:id/transactions` mapping.
  - When altering data persistence, reference `src/db` and `src/store/*.js` modules that use it.

If anything here is unclear or you'd like more details (for example, a quick walkthrough of `src/db/index.js` or the Vuex module patterns), tell me which area to expand and I will iterate.
