import { describe, expect, it } from 'vitest';
import {
  MAX_BUILDING_LEVEL,
  MAX_TERRAFORM,
  TERRAFORM_COST,
  TERRAFORM_STEP,
  TERRAFORM_TICKS,
} from '@/domain/buildings';
import type { GameState } from '@/domain/game';
import type { Planet } from '@/domain/types';
import { nextSteps } from './advice';
import {
  checkColonize,
  checkTerraform,
  checkUpgrade,
  colonize,
  startConstruction,
  startTerraform,
  startUpgrade,
  upgradeCost,
} from './commands';
import {
  buildingLevel,
  colonyCapacity,
  colonyReport,
  effectiveHabitability,
  planetOf,
} from './economy';
import { modifiersFor } from './modifiers';
import { researchTech } from './research';
import { colonyIdFor, createGame } from './state';
import { advance } from './tick';

const rich = (g: GameState): GameState => ({
  ...g,
  storyStage: 99,
  factions: {
    ...g.factions,
    terran: { ...g.factions.terran, resources: { credits: 9000, minerals: 9000, research: 9000 } },
  },
});
const base = () => rich(createGame(2479, 'terran'));
const capital = (g: GameState) => Object.values(g.colonies).find((c) => c.ownerId === 'terran')!;
const ok = (r: ReturnType<typeof colonize>): GameState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
const withTech = (g: GameState, ids: string[]): GameState =>
  ids.reduce((s, id) => ok(researchTech(s, 'terran', id)), g);

/** Finish any queued work on the capital. */
const settle = (g: GameState) => advance(g, 40);

describe('building upgrades', () => {
  const built = () => {
    let g = base();
    g = ok(startConstruction(g, 'terran', capital(g).id, 'mine'));
    return settle(g);
  };

  it('require the building and respect cost, queue, level cap', () => {
    const g = base();
    expect(checkUpgrade(g, 'terran', capital(g).id, 'mine')).toEqual({
      ok: false,
      reason: 'Not built yet.',
    });
    const b = built();
    const check = checkUpgrade(b, 'terran', capital(b).id, 'mine');
    expect(check).toMatchObject({ ok: true, level: 1 });
    expect(upgradeCost('mine', 1)).toEqual({ credits: 90, minerals: 45, research: 0 });
    expect(upgradeCost('mine', 2)).toEqual({ credits: 180, minerals: 90, research: 0 });
    const poor: GameState = {
      ...b,
      factions: {
        ...b.factions,
        terran: { ...b.factions.terran, resources: { credits: 1, minerals: 1, research: 0 } },
      },
    };
    expect(checkUpgrade(poor, 'terran', capital(b).id, 'mine')).toEqual({
      ok: false,
      reason: 'Insufficient resources.',
    });
  });

  it('raise output and upkeep by level, up to the maximum', () => {
    let g = built();
    const id = capital(g).id;
    const output = (s: GameState) => {
      const c = s.colonies[id]!;
      return colonyReport(c, planetOf(s, c.planetId)!, modifiersFor(s, 'terran'));
    };
    const lvl1 = output(g);
    g = settle(ok(startUpgrade(g, 'terran', id, 'mine')));
    expect(buildingLevel(g.colonies[id]!, 'mine')).toBe(2);
    const lvl2 = output(g);
    expect(lvl2.production.minerals).toBeCloseTo(lvl1.production.minerals * 1.5);
    expect(lvl2.upkeep).toBeGreaterThan(lvl1.upkeep);

    g = settle(ok(startUpgrade(g, 'terran', id, 'mine')));
    expect(buildingLevel(g.colonies[id]!, 'mine')).toBe(MAX_BUILDING_LEVEL);
    expect(output(g).production.minerals).toBeCloseTo(lvl1.production.minerals * 2);
    expect(checkUpgrade(g, 'terran', id, 'mine')).toEqual({
      ok: false,
      reason: 'Already at maximum level.',
    });
    expect(g.events.at(-1)!.message).toContain('upgraded to level 3');
  });

  it('cannot start the same upgrade twice at once', () => {
    const b = built();
    const id = capital(b).id;
    const g = ok(startUpgrade(b, 'terran', id, 'mine'));
    expect(checkUpgrade(g, 'terran', id, 'mine')).toEqual({
      ok: false,
      reason: 'Already being worked on.',
    });
  });
});

describe('hostile-environment habitats', () => {
  /** An explored, adjacent, unclaimed planet with habitability in [5, 20). */
  const poorTarget = (g: GameState): { g: GameState; planet: Planet } => {
    const explored: GameState = {
      ...g,
      systemStates: Object.fromEntries(
        Object.entries(g.systemStates).map(([id, st]) => [
          id,
          { ...st, exploration: { ...st.exploration, terran: 'explored' as const } },
        ]),
      ),
    };
    const unlocked = withTech(explored, ['bioHabitats', 'deepCore', 'hostileHabitats']);
    const planet = unlocked.galaxy.planets.find(
      (p) =>
        p.habitability >= 5 &&
        p.habitability < 20 &&
        !unlocked.colonies[colonyIdFor(p.id)] &&
        checkColonize(unlocked, 'terran', p.id).ok,
    )!;
    return { g: unlocked, planet };
  };

  it('lets a faction settle poor planets only after the tech', () => {
    const g0 = base();
    const { g, planet } = poorTarget(g0);
    expect(planet).toBeDefined();
    const before = explored(g0);
    expect(checkColonize(before, 'terran', planet.id)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('Hostile-Environment Habitats'),
    });
    const settled = ok(colonize(g, 'terran', planet.id));
    expect(settled.colonies[colonyIdFor(planet.id)]).toMatchObject({ ownerId: 'terran' });
    // Tiny population, but a mining outpost still works.
    expect(colonyCapacity(planet)).toBeLessThanOrEqual(2);
    const withMine = ok(startConstruction(settled, 'terran', colonyIdFor(planet.id), 'mine'));
    expect(settle(withMine).colonies[colonyIdFor(planet.id)]!.buildings).toContain('mine');
  });

  it('never allows gas giants (habitability 0)', () => {
    const { g } = poorTarget(base());
    const gas = g.galaxy.planets.find((p) => p.habitability === 0);
    if (gas) expect(checkColonize(g, 'terran', gas.id).ok).toBe(false);
  });

  const explored = (g: GameState): GameState => ({
    ...g,
    systemStates: Object.fromEntries(
      Object.entries(g.systemStates).map(([id, st]) => [
        id,
        { ...st, exploration: { ...st.exploration, terran: 'explored' as const } },
      ]),
    ),
  });
});

describe('terraforming', () => {
  const unlocked = () =>
    withTech(base(), ['bioHabitats', 'deepCore', 'hostileHabitats', 'fusionGrid', 'terraforming']);

  it('requires the tech', () => {
    const g = base();
    expect(checkTerraform(g, 'terran', capital(g).id)).toEqual({
      ok: false,
      reason: 'Requires Terraforming.',
    });
  });

  it('charges, takes time, then raises habitability and the population cap', () => {
    let g = unlocked();
    const id = capital(g).id;
    const planet = planetOf(g, capital(g).planetId)!;
    const minerals = g.factions.terran.resources.minerals;
    const capBefore = colonyCapacity(planet, 0);
    g = ok(startTerraform(g, 'terran', id));
    expect(g.factions.terran.resources.minerals).toBe(minerals - TERRAFORM_COST.minerals);
    expect(g.colonies[id]!.queue).toEqual([{ kind: 'terraform', remaining: TERRAFORM_TICKS }]);
    expect(checkTerraform(g, 'terran', id)).toEqual({
      ok: false,
      reason: 'Terraforming already under way.',
    });
    g = advance(g, TERRAFORM_TICKS);
    expect(g.colonies[id]!.terraform).toBe(TERRAFORM_STEP);
    expect(effectiveHabitability(planet, g.colonies[id]!.terraform)).toBe(
      Math.min(100, planet.habitability + TERRAFORM_STEP),
    );
    expect(colonyCapacity(planet, g.colonies[id]!.terraform)).toBeGreaterThanOrEqual(capBefore);
  });

  it('stops at the maximum and at perfect habitability', () => {
    let g = unlocked();
    const id = capital(g).id;
    for (let i = 0; i < 3; i++) {
      const r = startTerraform(g, 'terran', id);
      if (!r.ok) break;
      g = advance(r.state, TERRAFORM_TICKS);
    }
    const c = g.colonies[id]!;
    expect(c.terraform).toBeLessThanOrEqual(MAX_TERRAFORM);
    expect(checkTerraform(g, 'terran', id).ok).toBe(false);
  });

  it('really lifts the population ceiling on a poor world', () => {
    const g = unlocked();
    const poor = g.galaxy.planets.find(
      (p) => p.habitability >= 5 && p.habitability < 20 && p.size === 3,
    );
    if (!poor) return;
    expect(colonyCapacity(poor, MAX_TERRAFORM)).toBeGreaterThan(colonyCapacity(poor, 0));
  });
});

describe('next-steps advice', () => {
  it('points a new player at a mine, planets to settle and builds', () => {
    const g = rich(createGame(2479, 'terran'));
    const steps = nextSteps(g, 'terran');
    expect(steps.join(' ')).toMatch(/Mining Complex/);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThanOrEqual(5);
  });

  it('suggests upgrades once everything is built, and terraforming when capped', () => {
    let g = withTech(base(), [
      'bioHabitats',
      'deepCore',
      'hostileHabitats',
      'fusionGrid',
      'terraforming',
    ]);
    for (const b of ['mine', 'lab', 'tradeHub'] as const) {
      g = settle(ok(startConstruction(g, 'terran', capital(g).id, b)));
    }
    const text = nextSteps(g, 'terran').join(' ');
    expect(text).toMatch(/Upgrade the|Terraform/);
  });

  it('explains the way out when no good planets remain', () => {
    // Everything habitable is claimed; poor planets remain.
    const g0 = base();
    const claimed: GameState = {
      ...g0,
      galaxy: {
        ...g0.galaxy,
        planets: g0.galaxy.planets.map((p) => ({
          ...p,
          habitability: Math.min(p.habitability, 12),
        })),
      },
      systemStates: Object.fromEntries(
        Object.entries(g0.systemStates).map(([id, st]) => [
          id,
          { ...st, exploration: { ...st.exploration, terran: 'explored' as const } },
        ]),
      ),
    };
    expect(nextSteps(claimed, 'terran').join(' ')).toMatch(/Hostile-Environment Habitats/);
  });

  it('never returns more than five hints and is deterministic', () => {
    const g = base();
    expect(nextSteps(g, 'terran')).toEqual(nextSteps(g, 'terran'));
    expect(nextSteps(g, 'terran').length).toBeLessThanOrEqual(5);
  });
});
