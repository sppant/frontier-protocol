# Frontier Protocol

A real-time space strategy game for the browser.

**The year is 2479.** An ancient network of structures, the **Nexus**, has been found across sixteen star systems. Four civilizations race to explore it, claim it and understand it. You lead one of them; three deterministic bot rivals lead the others.

Everything runs locally in your browser: no accounts, no server, no network calls. Your match autosaves to IndexedDB.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build: `npm run build && npm run preview`.

Requires Node 20+ (developed on Node 22).

### How to play

The game starts **paused**. Press **▶ Resume** and use **1× / 2× / 4×** to set the pace; pause at any time to issue orders. A short tutorial runs on your first match (Settings → Show again to replay).

| Goal     | How                                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explore  | Select a _detected_ system (dim dot next to your territory) and **Send expedition**. A scout flies the hyperlanes and surveys it, revealing planets and neighbours.               |
| Expand   | Select an explored system and **Colonize** habitable planets in or next to your territory. Most good planets are gone by around day 200.                                          |
| Produce  | **Mining Complexes** are your only source of minerals; **Research Labs** make research; **Trade Hubs** make credits. Watch upkeep: colonies and buildings cost credits every day. |
| Research | Spend research on technologies in the **Research** tab. Each faction has a unique tech.                                                                                           |
| Decide   | Story and random events pause time and ask you to choose. Choices cost or reward resources.                                                                                       |
| Watch    | **Objectives** shows suggested next steps, your progress, a score-over-time chart and live standings. **Rival activity** (event feed) explains what each bot did and why.         |

### Factions

| Faction            | Strengths                                                                    |
| ------------------ | ---------------------------------------------------------------------------- |
| Terran Directorate | Cheap, fast colonization; +5% credits. Unique tech: Rapid Charters.          |
| Helion Collective  | +30% research, +20% fleet speed. Unique tech: Deep Survey Arrays.            |
| Veydran Dominion   | +20% minerals; weaker credits and research. Unique tech: War Economy.        |
| The Oracles        | −30% upkeep, +10% research; slower growth. Unique tech: Precursor Resonance. |

### Winning

Any faction, including the bots, can win in three ways:

1. **Nexus Ascendancy:** research the chain to _Nexus Attunement_ (unlocks at the Convergence, day 300), then hold on through a public 100-day attunement. Everyone can see who is attuning.
2. **Dominion:** control 10 of the 16 systems.
3. **Hegemony:** if nobody has won by day 720, the highest score wins.

### Difficulty

Rival difficulty changes how well bots _decide_ (speed, planning, mistakes), never what resources they get.

## Tech

React 19 · TypeScript (strict) · Vite · Zustand · React Three Fiber / Three.js / Drei · ECharts · CSS Modules · IndexedDB · Vitest · React Testing Library · Playwright (+ axe-core accessibility audit).

The simulation (`src/sim`) and bot AI (`src/bots`) are pure, seeded and deterministic: the same seed and the same actions always produce the same match. They know nothing about React, so they are tested headlessly and could move to a Web Worker or a server later. See [`CLAUDE.md`](./CLAUDE.md) for architecture, rules, balance notes and conventions.

## Scripts

| Command                             | What it does                                                          |
| ----------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                       | Dev server                                                            |
| `npm run build` / `npm run preview` | Type-check, bundle, serve the build                                   |
| `npm run check`                     | Type-check, lint, format check and all unit/integration tests         |
| `npm run test:e2e`                  | Build, then Playwright end-to-end, responsive and accessibility tests |
| `npm run format`                    | Prettier                                                              |

First e2e run: `npx playwright install chromium`.

## Known limitations

No combat or diplomacy yet (the Warlord personality is territorial only), a single save slot, and no cross-device sync. Balance was tuned by headless simulation rather than extensive human play. See `CLAUDE.md` for more.
