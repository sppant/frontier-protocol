# Frontier Protocol — project guide

## Overview

Single-player, real-time space strategy game in the browser. Year 2479: an ancient spacetime network (the **Nexus**) is found across unexplored systems. The player leads one of four factions (Terran Directorate, Helion Collective, Veydran Dominion, The Oracles) against three deterministic bots. Loop: explore → expedition → discover → colonize → produce → research → expand → compete → uncover the Nexus mystery. Real-time with pause and speed (1×/2×/4×). No backend, no accounts, no AI APIs.

## Stack

React 19 · TypeScript (pinned `~6.0`: typescript-eslint doesn't support TS 7 yet) · Vite 8 · Zustand · React Three Fiber + Three + Drei · ECharts · CSS Modules + CSS tokens · Vitest + React Testing Library · Playwright · ESLint + Prettier. Save data: IndexedDB (planned).

## Architecture (`src/`)

- `domain/` — entity types, constants, static data (factions, buildings, techs). No logic dependencies on React.
- `sim/` — pure, deterministic simulation: seeded RNG, tick, resources, colonies, fleets, research, events, victory. No React/DOM.
- `bots/` — utility-based bot decision engine (pure; consumes sim state, returns actions + decision log).
- `store/` — Zustand stores bridging sim ↔ UI. Game logic stays out of stores/components.
- `persistence/` — versioned save schema, validation, migrations, IndexedDB adapter.
- `render/` — React Three Fiber galaxy scene; reads state, emits selection only.
- `ui/primitives` — design-system components (Button, Panel, StatusDot…); `ui/layout` — shell, top bar, panels.
- `styles/` — `tokens.css` (colors, spacing, type) and `global.css`.
- `e2e/` — Playwright specs. Unit tests live beside code as `*.test.ts(x)`.
- Import alias `@/` → `src/`.

## Simulation rules (current)

- 1 tick = 1 game day; 1× speed = 1 tick/second (`TICK_MS`), 2×/4× scale it; paused = no ticks. Catch-up capped at 30 ticks/step.
- Tick order: income & upkeep (from start-of-tick state) → construction → population growth → `tick++`. Credits clamp at 0 and set `deficit` (one event on entry).
- Resources: credits (tax 0.5/pop, trade hub), minerals (mine: 2 + planet richness), research (lab: 1 + 0.25/pop). Colony upkeep 1¢ + 0.5¢/building. Faction `modifiers` (`domain/factions.ts`) scale output, colony cost, growth and upkeep.
- Colonize: planet habitability ≥ 20, system explored, not controlled by another faction, in/adjacent to own territory, cost 120¢ + 60⛏ × faction `colonyCost`. Colonization is instant for now; Phase 4 will route it through expeditions/fleets.
- Expeditions: target must be `detected` (adjacent to explored); cost 40¢; scout flies from the nearest owned system along hyperlanes at 3 units/tick (≥1 tick/hop); consumed on arrival. Fleets move _after_ the economy step in a tick.
- Build queue max 3 per colony; each building once per colony; cost paid up-front.
- No RNG consumed by tick yet; when events need it, add `rngState` to `GameState` (serializable) rather than a global RNG.

## Map ↔ state boundary

Renderers read `useGameStore((s) => s.game.galaxy / .systemStates)` and only call `useSelectionStore` `select`/`hover`. `GalaxyScene` is lazy-loaded (keeps three.js out of the main chunk and out of jsdom tests). Unknown systems are anonymous in UI (`displayName`). Shared visual constants live in `render/visuals.ts`; faction colors in `domain/factions.ts` (mirror `--faction-*` tokens).

## Conventions

- Strict TS, no `any`. Pure functions for rules. Stable string IDs for entities.
- All gameplay randomness via the seeded RNG; same seed + same actions ⇒ same result.
- Simulation advances by fixed ticks driven by a game clock, independent of `requestAnimationFrame`. Bots decide on defined tick intervals, never per frame.
- Save data is versioned; every format change adds a migration.
- UI: dark console look, single amber accent (`--accent`); faction colors are the only other hues. No dead controls — omit or mark unavailable.
- Respect `prefers-reduced-motion`.

## Commands

`npm run dev` · `npm run build` · `npm run check` (typecheck + lint + format:check + unit tests) · `npm run test:e2e` (builds + Playwright; first run needs `npx playwright install chromium`).

## Git workflow

Remote `origin` = https://github.com/sppant/frontier-protocol.git, branch `main`. Commit and push after every completed task (conventional commits). Never force-push, no secrets/build artifacts, no co-author trailers. Run `npm run check` before committing.

## Status

- [x] Phase 1 foundation: tooling, tokens, primitives, app shell with working pause/speed controls (placeholder map/panels are clearly labeled).
- [x] Phase 2 galaxy visualization: seeded RNG + deterministic `generateGalaxy` (16 systems, hyperlanes, 4 capitals), `galaxyStore` (galaxy, per-system `SystemState`, selection/hover), R3F scene (instanced stars, lanes, territory rings, selection ring, starfield, nebulae, OrbitControls), 2D SVG `SimpleMap` fallback (no WebGL / player toggle), `SystemInspector`. Ownership/exploration is initial state only; sim will mutate it.
- [x] Phase 3 simulation core: `GameState` (serializable, `domain/game.ts`), `createGame(seed, faction)`, pure `tick`/`advance`, economy (`colonyReport`/`factionReport`, logistic population growth), commands (`checkColonize`/`colonize`, `checkBuild`/`startConstruction`), wall-clock `advanceClock` driven by `store/gameLoop.ts` (setInterval 100ms, not rAF). `gameStore` holds the state; `selectionStore` holds map selection. Top bar shows resources + net/day + day counter; inspector offers Colonize/Build with reasons on disabled buttons.
- [x] Phase 4a exploration: fog of war is **per faction** (`SystemState.exploration: Record<FactionId, ExplorationStatus>`; read via `explorationOf` / `useExploration()`), scout expeditions (`sim/fleets.ts`: Dijkstra `findPath`, `checkExpedition`/`launchExpedition`, `advanceFleets`, `fleetEta`/`fleetPosition`/`fleetRoute`), survey reveals the system + detects neighbours, anomalies pay research. `EventFeed` (player events + active expeditions), fleet markers in 3D and SVG maps.
- [ ] Phase 4b: technology research, events with choices, victory conditions.
- [ ] Phase 4 (rest) gameplay · Phase 5 bots · Phase 6 full UI · Phase 7 persistence/polish · Phase 8 verification.

## Known limitations / next

Tech, events, victory and bots not yet built; no persistence yet; WebGL canvas itself is verified only via Playwright (jsdom has no WebGL). Vite 8 uses Rolldown, so `manualChunks` object form is unsupported; revisit chunk splitting if bundle size matters.
