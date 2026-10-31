# Frontier Protocol — project guide

## Overview

Single-player, real-time space strategy game in the browser. Year 2479: an ancient spacetime network (the **Nexus**) is found across 16 star systems. The player leads one of four factions (Terran Directorate, Helion Collective, Veydran Dominion, The Oracles) against three deterministic bots. Loop: explore → expedition → discover → colonize → produce → research → expand → compete → uncover the Nexus. Real time with pause and 1×/2×/4× speed. No backend, no accounts, no AI APIs; bots are plain utility AI and work offline.

## Stack

React 19 · TypeScript (pinned `~6.0`: typescript-eslint doesn't support TS 7 yet) · Vite 8 (Rolldown) · Zustand · React Three Fiber + Three + Drei · CSS Modules + CSS tokens · Vitest + React Testing Library · Playwright (+ axe-core) · ESLint + Prettier · IndexedDB for saves · ECharts (tree-shaken, lazy) for the standings chart.

## Architecture (`src/`)

Dependency direction: `domain` ← `sim` ← `bots` ← `engine` ← `store` ← `ui`/`render`. `sim/` never imports bots, stores or React.

- `domain/` — types and static data: factions (+ modifiers), buildings, techs, events/story, bot types, `GameState` (`game.ts`).
- `sim/` — pure deterministic rules: seeded `rng`, `galaxyGen`, `state` (createGame), `tick`, `economy`, `commands` (colonize/build), `fleets` (expeditions), `research`, `events`, `victory`, `modifiers`, `clock`.
- `bots/` — utility AI: `personalities` (weights, difficulty), `candidates` (legal actions + scoring), `decide` (decision round, objective, log).
- `engine/step.ts` — composes `tick` + bots: `step`, `advanceGame` (stops at a pending decision/victory), `newGame`, `withBots`. **Always run games through the engine**; `sim/tick` alone has no bots.
- `persistence/` — save envelope + `validate.ts` + `migrate`, `storage.ts` (IndexedDB/memory), `saveGame.ts`, `autosave.ts`.
- `store/` — Zustand: `gameStore` (authoritative `GameState` + command wrappers), `selectionStore`, `clockStore`, `viewStore` (tabs/tutorial/settings/render mode), `appStore` (screen, save status), `gameLoop` (wall-clock driver), `session` (boot/new/continue/quit/autosave wiring), `selectors`.
- `render/` — R3F `GalaxyScene` (lazy), 2D `SimpleMap` fallback, `GalaxyMap` switcher, shared `visuals`.
- `ui/` — `primitives/` (Button, Panel, Tabs, Dialog, StatusDot), `layout/` (AppShell, TopBar, SidePanel), `panels/` (inspector, research, objectives + `ScoreChart`, feed, dialogs), `screens/` (menu, new game, settings, onboarding).
- `styles/` tokens + global; `e2e/` Playwright specs; unit tests sit beside code (`*.test.ts(x)`). Alias `@/` → `src/`.

## Simulation rules

- 1 tick = 1 game day; 1× = 1 tick/second (`TICK_MS`). Catch-up capped at 30 ticks/step. `advanceGame` halts the moment a player decision is pending or the match ends; the loop pauses the clock synchronously.
- Tick order: income & upkeep → construction → population growth → `tick++` → fleet movement → events → victory check; then (engine) bot decisions. Credits clamp at 0 (`deficit` flag + one event).
- Resources: credits (tax 0.5/pop; trade hub 2 + 0.4/pop), minerals (mine: 2 + planet richness; **minerals come only from mines**), research (lab: 1 + 0.12/pop). Upkeep 1¢/colony + 0.5¢/building. Faction `modifiers` and tech multipliers (`sim/modifiers.ts#modifiersFor`) scale everything.
- Colonize (instant): habitability ≥ 20 (≥ 5 with _Hostile-Environment Habitats_; those outposts cost ×1.5), system explored by you, not another faction's, in/adjacent to your territory; 120¢ + 60⛏ × `colonyCost`. Gas giants (0) are never colonizable.
- Colony construction queue ≤ 3 jobs (`build` / `upgrade` / `terraform`). Each building once; **upgrades** to Lv2/Lv3 (+50% output and +50% upkeep per level, cost = base × 1.5 × current level); **terraforming** (needs the tech) adds +10 habitability per step, max +30, 150¢ + 100⛏, 15 days, and raises the population cap (`colonyCapacity(planet, colony.terraform)`).
- `sim/advice.ts#nextSteps` generates the "Suggested next steps" list (Objectives tab): pure, plain-language hints so the player always knows what is possible.
- Exploration is per faction (`SystemState.exploration[faction]`, `explorationOf`). Expedition: target `detected`, 40¢, scout flies hyperlanes (Dijkstra) at 3 × `fleetSpeed` units/tick, surveys on arrival (reveals neighbours within `surveyReach` hops; anomalies pay +25 research).
- Events: six story events at days 1/40/90/150/220/300 (chapters First Contact → Convergence); random events roll every 12 days at 40%, once each, via `GameState.rngState`. Player-only; one pending at a time.
- Victory (all factions, checked every tick): **Ascendancy** — research the capstone (32 000 research, needs story stage 6 / day 300) → a public 100-day Nexus Attunement; **Dominion** — own ≥ 10 of 16 systems; **Hegemony** — best `score` (10/system + pop + 5/tech) on day 720. Scores are sampled every 10 days into `GameState.history` (max 100) for the chart. `tick` is a no-op once `victory` is set.

## Bots

- Personalities: Pioneer (explore/expand), Merchant (economy), Warlord (contested frontier + minerals; there is no combat, so "military" = territorial claims), Oracle (research, safe interior, Ascendancy). Default by faction: terran=merchant, helion=pioneer, veydran=warlord, oracle=oracle; the player's faction has no bot.
- Difficulty changes decision quality only, never resources: easy = every 10d, 1 action, ±35% score noise, no reserve, no objective; normal = 6d, 2 actions, ±12%, 20¢ reserve, objective; hard = 4d, 3 actions, no noise, 40¢ reserve, objective + capstone-chain bonus.
- Bots use the same validated commands as the player. `GameState.bots[f]` holds personality, difficulty, private `rngState`, `nextDecisionTick` (staggered), objective and a capped decision `log` (label, utility, top-2 factors, 3 alternatives) shown in the feed's "Rival activity" tab.
- Safeguards found via headless simulation: keep one mine's worth of minerals until a mine exists; ≤ 2 concurrent expeditions; no colonizing into a deficit; min utility 0.2; bots wait while a player decision is pending.
- Balance (24 headless 720-day matches, hard "player" vs normal bots, after upgrades/terraforming/outposts): ~60% end by Ascendancy (day ~590–710), ~40% by Hegemony (day 720); Dominion (10 systems) is reachable but rare. Outposts made claiming much easier (an 8-system Dominion fell on day 170), hence the 10-system bar, ×1.5 outpost cost and a 300-research habitats tech. Bots use upgrades, terraforming and outposts; planning bots (normal/hard) credit techs for what they unlock (one-step lookahead), which made research rushes much stronger and required raising the capstone cost to 32 000.

## Persistence

- One slot `autosave` in IndexedDB (`frontier-protocol` / `saves`); memory fallback (menu warns) if unavailable.
- Autosave ≤ every 5 s when dirty, plus immediate flush on new match, event decision, victory, pause, tab hide/`pagehide`, Save now, quit to menu. Writes never overlap.
- Saves are validated on load (types, ranges, references); bad/unsupported/newer saves show a menu notice with "Discard broken save" and never crash.
- Save format is currently **v3** (v1→v2 added `history`; v2→v3 added colony `upgrades`/`terraform` and queue item `kind`). Migrations are real and tested with v1- and v2-shaped fixtures.
- **Changing `GameState` ⇒ bump `SAVE_VERSION` (`domain/game.ts`), add `MIGRATIONS[oldVersion]` in `persistence/save.ts`, update `validate.ts`, add a test.**
- Tutorial-seen flag: localStorage `fp.tutorialSeen` (convenience only).

## UI conventions

- Dark console look; one amber accent (`--accent`); faction colours (`domain/factions.ts`, mirrored in `--faction-*`) are the only other hues. Use tokens from `styles/tokens.css`; muted text is `--text-2` (kept AA-contrast).
- No dead controls: omit or disable-with-reason (disabled buttons expose the reason via `title`/text). Respect `prefers-reduced-motion`. Keyboard-reachable scroll regions (`Panel` body has `tabIndex=0`). Unknown systems stay anonymous (`displayName`).
- Map ↔ state: renderers read the game store and only call `selectionStore` `select`/`hover`. `GalaxyScene` is lazy so three.js stays out of the main chunk and jsdom tests. Module-level shared geometries/materials are intentional singletons; per-component textures are disposed.
- Layout: grid on desktop; ≤ 800 px stacks map / side panel / feed. The top bar wraps; e2e asserts no horizontal overflow at 390/768/1024/1440 px.

## Testing & commands

`npm run dev` · `npm run build` · `npm run check` (typecheck + lint + format:check + unit/integration) · `npm run test:e2e` (builds, serves preview on :4173, runs Playwright incl. axe a11y; first run: `npx playwright install chromium`).

- Unit tests are deterministic (seeded). Headless bot matches double as balance probes; there are no committed balance assertions beyond invariants, so re-run a probe (play 700+ days with `withBots` for all factions across seeds) after touching economy/bot/victory numbers.
- e2e helpers: `startMatch`, `resolveDialog`, `runUntil` (e2e/helpers.ts). New e2e tests must tolerate story/random event dialogs.
- Playwright `webServer` runs `npm run build` (includes `tsc`): an unused import in an e2e file fails the whole run with no test output.

## Git workflow

Remote `origin` = https://github.com/sppant/frontier-protocol.git, branch `main`. One coherent task per commit, pushed immediately; conventional commits; no force-push, no secrets/build artifacts, no co-author trailers. Run `npm run check` (and e2e for UI/sim changes) before committing.

## Status

All eight planned phases are implemented: foundation, galaxy map, simulation, exploration/tech/events/victory, bots, UI, persistence/onboarding, and polish/verification (a11y audit, responsive layout, balance pass, end-game e2e).

## Known limitations / ideas

- No combat, diplomacy or trade; Warlord is territorial only. Events affect only the player.
- Single save slot, no export/import, no cross-device sync.
- Colonization is instant (no colony ships); tech unlock is instant (no research queue). Terraforming is capped at +30 habitability.
- Rival decision logs are fully visible to the player (transparency, not fog of war).
- Balance is a first pass tuned by simulation, not by human playtesting. Dominion is rarely hit by bots.
- Initial 3D scene setup costs ~0.6 s of main-thread time (measured under software GL); the three/drei chunk is ~257 kB gzip and lazy-loaded. Importing specific drei modules could shrink it.
- Storybook was deliberately skipped (primitives are few and covered by tests).
