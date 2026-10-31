import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '@/domain/buildings';
import { FACTION_IDS } from '@/domain/factions';
import type { GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { advanceClock, MAX_TICKS_PER_STEP, TICK_MS } from './clock';
import { checkBuild, checkColonize, colonize, colonyCost, startConstruction } from './commands';
import { colonyCapacity, colonyReport, factionReport, growPopulation, planetOf } from './economy';
import { modifiersFor } from './modifiers';
import { colonyIdFor, createGame } from './state';
import { advance, tick } from './tick';

const SEED = 2479;
const newGame = (f: FactionId = 'terran') => createGame(SEED, f);

function homeOf(g: GameState, f: FactionId) {
  const system = g.galaxy.systems.find((s) => s.homeOf === f)!;
  const colony = g.colonies[colonyIdFor(system.planetIds[0]!)]!;
  return { system, colony, planet: planetOf(g, colony.planetId)! };
}

/** First colonizable planet adjacent to the player's territory, after giving them resources. */
function findTarget(g: GameState, f: FactionId) {
  const rich: GameState = {
    ...g,
    factions: {
      ...g.factions,
      [f]: { ...g.factions[f], resources: { credits: 5000, minerals: 5000, research: 0 } },
    },
    systemStates: Object.fromEntries(
      Object.entries(g.systemStates).map(([id, s]) => [
        id,
        {
          ...s,
          exploration: {
            terran: 'explored',
            helion: 'explored',
            veydran: 'explored',
            oracle: 'explored',
          } as const,
        },
      ]),
    ),
  };
  const planet = rich.galaxy.planets.find((p) => checkColonize(rich, f, p.id).ok)!;
  return { rich, planet };
}

describe('createGame', () => {
  it('gives every faction a capital colony and starting resources', () => {
    const g = newGame();
    for (const f of FACTION_IDS) {
      const { colony, planet } = homeOf(g, f);
      expect(colony.ownerId).toBe(f);
      expect(colony.population).toBeLessThanOrEqual(colonyCapacity(planet));
      expect(g.factions[f].resources).toEqual({ credits: 300, minerals: 150, research: 0 });
    }
    expect(g.tick).toBe(0);
  });

  it('is deterministic per seed', () => {
    expect(createGame(5, 'helion')).toEqual(createGame(5, 'helion'));
  });

  it('is JSON-serializable', () => {
    const g = advance(newGame(), 5);
    expect(JSON.parse(JSON.stringify(g))).toEqual(g);
  });
});

describe('economy', () => {
  it('computes colony production and upkeep from population and buildings', () => {
    const g = newGame('veydran'); // minerals ×1.2, credits ×0.95
    const { colony, planet } = homeOf(g, 'veydran');
    const bare = colonyReport(colony, planet, modifiersFor(g, 'veydran'));
    expect(bare.production.credits).toBeCloseTo(6 * 0.5 * 0.95);
    expect(bare.production.minerals).toBe(0);
    expect(bare.upkeep).toBeCloseTo(1);

    const withMine = colonyReport(
      { ...colony, buildings: ['mine'] },
      planet,
      modifiersFor(g, 'veydran'),
    );
    expect(withMine.production.minerals).toBeCloseTo((2 + planet.minerals) * 1.2);
    expect(withMine.upkeep).toBeCloseTo(1 + BUILDINGS.mine.upkeep);
  });

  it('faction modifiers create real differences', () => {
    const helion = newGame('helion');
    const terran = newGame('terran');
    const lab = (g: GameState, f: FactionId) => {
      const { colony, planet } = homeOf(g, f);
      return colonyReport({ ...colony, buildings: ['lab'] }, planet, modifiersFor(g, f)).production
        .research;
    };
    expect(lab(helion, 'helion')).toBeGreaterThan(lab(terran, 'terran'));
    expect(colonyCost(helion, 'terran').credits).toBeLessThan(colonyCost(helion, 'oracle').credits);
  });

  it('factionReport nets upkeep out of credits', () => {
    const g = newGame();
    const r = factionReport(g, 'terran');
    expect(r.colonies).toHaveLength(1);
    expect(r.net.credits).toBeCloseTo(r.colonies[0]!.production.credits - r.upkeep);
  });

  it('population grows logistically and never exceeds capacity', () => {
    const g = newGame();
    const { colony, planet } = homeOf(g, 'terran');
    let c = { ...colony, population: 1 };
    let prev = c.population;
    for (let i = 0; i < 500; i++) {
      c = { ...c, population: growPopulation(c, planet, 1) };
      expect(c.population).toBeGreaterThanOrEqual(prev);
      expect(c.population).toBeLessThanOrEqual(colonyCapacity(planet));
      prev = c.population;
    }
    expect(c.population).toBe(colonyCapacity(planet));
  });
});

describe('tick', () => {
  it('advances time and applies net income to every faction', () => {
    const g = newGame();
    const next = tick(g);
    expect(next.tick).toBe(1);
    for (const f of FACTION_IDS) {
      const net = factionReport(g, f).net;
      expect(next.factions[f].resources.credits).toBeCloseTo(300 + net.credits);
    }
    expect(g.tick).toBe(0); // input untouched
  });

  it('is deterministic', () => {
    expect(advance(newGame(), 50)).toEqual(advance(newGame(), 50));
  });

  it('clamps credits at zero and flags a deficit once', () => {
    const g = newGame();
    const broke: GameState = {
      ...g,
      factions: {
        ...g.factions,
        terran: { ...g.factions.terran, resources: { credits: 0, minerals: 0, research: 0 } },
      },
      colonies: Object.fromEntries(
        Object.entries(g.colonies).map(([id, c]) => [
          id,
          c.ownerId === 'terran' ? { ...c, population: 0 } : c,
        ]),
      ),
    };
    const next = tick(broke);
    expect(next.factions.terran.resources.credits).toBe(0);
    expect(next.factions.terran.deficit).toBe(true);
    expect(next.events.filter((e) => e.kind === 'economy')).toHaveLength(1);
    expect(tick(next).events.filter((e) => e.kind === 'economy')).toHaveLength(1);
  });
});

describe('construction', () => {
  it('charges cost, builds over time, then boosts production', () => {
    const g = newGame();
    const { colony } = homeOf(g, 'terran');
    const res = startConstruction(g, 'terran', colony.id, 'mine');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.factions.terran.resources.minerals).toBe(150 - BUILDINGS.mine.cost.minerals);
    expect(res.state.colonies[colony.id]!.queue).toEqual([
      { kind: 'build', building: 'mine', remaining: BUILDINGS.mine.buildTicks },
    ]);

    const done = advance(res.state, BUILDINGS.mine.buildTicks);
    expect(done.colonies[colony.id]!.buildings).toContain('mine');
    expect(done.colonies[colony.id]!.queue).toHaveLength(0);
    expect(done.events.some((e) => e.kind === 'construction')).toBe(true);
    expect(factionReport(done, 'terran').net.minerals).toBeGreaterThan(0);
  });

  it('rejects duplicates, unaffordable builds, full queues and foreign colonies', () => {
    const g = newGame();
    const { colony } = homeOf(g, 'terran');
    const first = startConstruction(g, 'terran', colony.id, 'mine');
    if (!first.ok) throw new Error('expected ok');
    expect(checkBuild(first.state, 'terran', colony.id, 'mine')).toEqual({
      ok: false,
      reason: 'Already built or queued.',
    });
    expect(checkBuild(g, 'helion', colony.id, 'lab').ok).toBe(false);
    const poor: GameState = {
      ...g,
      factions: {
        ...g.factions,
        terran: { ...g.factions.terran, resources: { credits: 1, minerals: 1, research: 0 } },
      },
    };
    expect(checkBuild(poor, 'terran', colony.id, 'lab')).toEqual({
      ok: false,
      reason: 'Insufficient resources.',
    });
    expect(startConstruction(poor, 'terran', colony.id, 'lab').ok).toBe(false);
  });
});

describe('colonization', () => {
  it('requires exploration, habitability, reach and resources', () => {
    const g = newGame();
    const unexplored = g.galaxy.planets.find(
      (p) => g.systemStates[p.systemId]!.exploration.terran === 'unknown' && p.habitability >= 20,
    )!;
    expect(checkColonize(g, 'terran', unexplored.id)).toEqual({
      ok: false,
      reason: 'System must be explored first.',
    });

    const { planet } = homeOf(g, 'terran');
    expect(checkColonize(g, 'terran', planet.id)).toEqual({
      ok: false,
      reason: 'Planet is already colonized.',
    });

    const { rich } = findTarget(g, 'terran');
    const gas = rich.galaxy.planets.find((p) => p.habitability < 20)!;
    expect(checkColonize(rich, 'terran', gas.id).ok).toBe(false);

    const enemyHome = homeOf(g, 'veydran');
    const sibling = rich.galaxy.planets.find(
      (p) =>
        p.systemId === enemyHome.system.id && p.id !== enemyHome.planet.id && p.habitability >= 20,
    );
    if (sibling) {
      const c = checkColonize(rich, 'terran', sibling.id);
      expect(c.ok).toBe(false);
      if (!c.ok) expect(c.reason).toMatch(/another faction/);
    }
  });

  it('founds a colony, pays the faction-adjusted cost and claims the system', () => {
    const g = newGame();
    const { rich, planet } = findTarget(g, 'terran');
    const before = rich.factions.terran.resources;
    const res = colonize(rich, 'terran', planet.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const cost = colonyCost(rich, 'terran');
    expect(res.state.factions.terran.resources.credits).toBe(before.credits - cost.credits);
    expect(res.state.factions.terran.resources.minerals).toBe(before.minerals - cost.minerals);
    expect(res.state.colonies[colonyIdFor(planet.id)]).toMatchObject({
      ownerId: 'terran',
      population: 1,
    });
    expect(res.state.systemStates[planet.systemId]!.ownerId).toBe('terran');
    expect(res.state.events.at(-1)!.kind).toBe('colony');
    expect(colonize(res.state, 'terran', planet.id).ok).toBe(false);
  });

  it('is cheaper for the Terran Directorate than the Oracles', () => {
    const g = newGame();
    expect(colonyCost(g, 'terran').credits).toBe(96);
    expect(colonyCost(g, 'oracle').credits).toBe(132);
  });
});

describe('clock', () => {
  it('converts real time to ticks by speed and keeps the remainder', () => {
    expect(advanceClock(0, TICK_MS, 1, false)).toEqual({ ticks: 1, accMs: 0 });
    expect(advanceClock(0, TICK_MS, 4, false)).toEqual({ ticks: 4, accMs: 0 });
    expect(advanceClock(600, 600, 1, false)).toEqual({ ticks: 1, accMs: 200 });
  });

  it('does nothing while paused', () => {
    expect(advanceClock(300, 5000, 4, true)).toEqual({ ticks: 0, accMs: 0 });
  });

  it('caps catch-up after a long stall', () => {
    expect(advanceClock(0, 10 * 60 * 1000, 4, false).ticks).toBe(MAX_TICKS_PER_STEP);
  });
});
