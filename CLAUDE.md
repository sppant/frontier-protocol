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
- Tick order: income & upkeep (from start-of-tick state) → construction → population growth → `tick++` → fleet movement → events → victory check; then (engine) bot decisions. Credits clamp at 0 and set `deficit` (one event on entry).
- Resources: credits (tax 0.5/pop, trade hub), minerals (mine: 2 + planet richness), research (lab: 1 + 0.25/pop). Colony upkeep 1¢ + 0.5¢/building. Faction `modifiers` (`domain/factions.ts`) scale output, colony cost, growth and upkeep.
- Colonize: planet habitability ≥ 20, system explored, not controlled by another faction, in/adjacent to own territory, cost 120¢ + 60⛏ × faction `colonyCost`. Colonization is instant for now; Phase 4 will route it through expeditions/fleets.
- Expeditions: target must be `detected` (adjacent to explored); cost 40¢; scout flies from the nearest owned system along hyperlanes at 3 units/tick (≥1 tick/hop); consumed on arrival. Fleets move _after_ the economy step in a tick.
- Build queue max 3 per colony; each building once per colony; cost paid up-front.
- Events: story events fire in order at days 1/40/90/150/220/300 (chapters First Contact…Convergence); random events roll every 12 days at 40%, each once per game, using `GameState.rngState`. Events affect the player only (bots don't receive/decide events). One pending event at a time; choices must be affordable.
- Tech: instant unlock on payment (no queue); unique tech per faction; modifiers are base × product of tech multipliers.
- Victory (checked every tick, first in faction order wins ties): Ascendancy (capstone tech), Dominion (≥10 owned systems), Hegemony (best `score` = 10/system + pop + 5/tech at day 720). `tick` is a no-op once `victory` is set.

## Bot rules (current)

- Layering: `bots/` depends on `sim/`; `sim/` never imports bots. Always run the game through `engine/step.ts` (`advanceGame`/`newGame`); `sim/tick` alone has no bots.
- Personalities: Pioneer (explore/expand), Merchant (economy), Warlord (contested frontier + minerals; no combat exists yet, so "military" = territorial claims), Oracle (research, safe interior, Ascendancy). Default per faction: terran=merchant, helion=pioneer, veydran=warlord, oracle=oracle; the player's faction gets no bot.
- Difficulty (no resource bonuses): easy = decide every 10d, 1 action, ±35% score noise, no reserve, no objective; normal = 6d, 2 actions, ±12%, 20¢ reserve, objective; hard = 4d, 3 actions, no noise, 40¢ reserve, objective (+ capstone-chain bonus for Ascendancy).
- Safeguards learned from simulation: keep one mine's worth of minerals until a mine exists (minerals only come from mines); max 2 concurrent expeditions; no colonizing into a credit deficit; minimum utility 0.2; bots hold their turn while a player decision is pending.
- Decisions are due at `nextDecisionTick` (staggered per faction), never per frame.
- Ascendancy: capstone research starts a public 100-day Nexus Attunement (`attunementDone`); first to complete wins. Gated to story stage 6 (day 300). Lab output was tuned down (1 + 0.12/pop) after headless sims showed research hoarding.
- Balance notes (headless 720-day sims, 10 seeds): bots reach the capstone at ~day 300 and win Ascendancy ~day 400 if unopposed; the map saturates (all habitable planets claimed) by ~day 200, so early claiming decides Dominion. Phase 8 should re-tune against human play.

## Persistence (current)

- One slot, `autosave`, in IndexedDB db `frontier-protocol` / store `saves`. If IndexedDB is unavailable, falls back to memory and the menu warns that progress won't persist.
- Autosave: routine save at most every 5 s while a match is on screen and the state changed; immediate flush on: new match, event decision, victory, pausing, tab hidden/`pagehide`, Settings → Save now, quit to menu. Writes never overlap (coalesced).
- Saves are validated on load (types, ranges, references). Invalid/unsupported saves surface as a menu notice with "Discard broken save"; they never crash the app. Saves from a newer version are rejected.
- **Changing the shape of `GameState` ⇒ bump `SAVE_VERSION` (domain/game.ts) and add `MIGRATIONS[oldVersion]` in `persistence/save.ts`**, plus a test. `validateGameState` must be updated with every new field.
- Round-trip determinism is tested: load(save(x)) continues identically to x.
- Tutorial-seen flag lives in localStorage (`fp.tutorialSeen`), a per-device convenience only.

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
- [x] Phase 4b progression: techs (`domain/techs.ts`, bought with the research stockpile; effects multiply faction modifiers via `sim/modifiers.ts#modifiersFor`; capstone `nexusAttunement` gated by story stage 5), story chapters + random events with choices (`domain/events.ts`, `sim/events.ts`; seeded `rngState` lives in `GameState`), victory (`sim/victory.ts`: Ascendancy / Dominion 10 systems / Hegemony score at day 720; applies to every faction). UI: tabbed `SidePanel` (Inspector/Research/Objectives), `Dialogs` (event + victory). Game loop auto-pauses on pending event / victory; Resume is disabled meanwhile.
- [x] Phase 5 bots: `bots/` (pure utility AI: `personalities.ts` weights + difficulty defs, `candidates.ts` legal-action generation & scoring, `decide.ts` decision round + objective + log) and `engine/step.ts` (`step` = `tick` then bots; `advanceGame` stops at a pending decision/victory; `newGame`/`withBots`). Bots act only via the same commands as the player (colonize/build/research/expedition). `GameState.bots[faction]` holds personality, difficulty, private `rngState`, `nextDecisionTick`, objective, capped decision `log` (label, utility, top-2 factors, 3 alternatives). UI: "Rival activity" feed tab.
- [x] Phase 7a persistence & start flow: `persistence/` (`validate.ts` runtime validator w/ referential integrity → `SaveError`; `save.ts` envelope `{format, version, savedAt, game}` + `migrate` chain; `storage.ts` `SaveStore` = `IndexedDbStore` | `MemoryStore` fallback; `saveGame.ts` never-throws `loadGame` → none/ok/corrupt; `autosave.ts` throttled non-overlapping `Autosaver`), `store/session.ts` orchestration (`bootSession`, `startNewGame`, `continueGame`, `quitToMenu`, `startAutosave`), `appStore` (screen: boot/menu/setup/game, save summary/status), screens `MainMenu`/`NewGameScreen`/`SettingsDialog`/`Onboarding`.
- [ ] Phase 4 (rest) gameplay · Phase 5 bots · Phase 6 full UI · Phase 7 persistence/polish · Phase 8 verification.

## Known limitations / next

No combat/diplomacy; single save slot; no cross-device sync; no persistence yet; WebGL canvas itself is verified only via Playwright (jsdom has no WebGL). Vite 8 uses Rolldown, so `manualChunks` object form is unsupported; revisit chunk splitting if bundle size matters.
