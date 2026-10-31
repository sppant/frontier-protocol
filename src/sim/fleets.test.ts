import { describe, expect, it } from 'vitest';
import type { GameState } from '@/domain/game';
import { explorationOf, type FactionId } from '@/domain/types';
import {
  ANOMALY_RESEARCH_REWARD,
  EXPEDITION_COST,
  checkExpedition,
  findPath,
  fleetPosition,
  launchExpedition,
  laneLength,
  travelTicks,
} from './fleets';
import { createGame } from './state';
import { advance } from './tick';

const game = (f: FactionId = 'terran') => createGame(2479, f);

function detectedTarget(g: GameState, f: FactionId) {
  const id = Object.keys(g.systemStates).find(
    (k) => explorationOf(g.systemStates[k], f) === 'detected',
  )!;
  return g.galaxy.systems.find((s) => s.id === id)!;
}

function launch(g: GameState, f: FactionId, target: string): GameState {
  const r = launchExpedition(g, f, target);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

describe('pathfinding', () => {
  it('finds a connected path and is symmetric in length', () => {
    const g = game().galaxy;
    const a = g.systems[0]!.id;
    const b = g.systems.at(-1)!.id;
    const p = findPath(g, a, b)!;
    expect(p[0]).toBe(a);
    expect(p.at(-1)).toBe(b);
    const len = (path: string[]) =>
      path.slice(1).reduce((s, id, i) => s + laneLength(g, path[i]!, id), 0);
    expect(len(findPath(g, b, a)!)).toBeCloseTo(len(p));
    expect(findPath(g, a, a)).toEqual([a]);
  });

  it('travel time scales with lane length', () => {
    const g = game().galaxy;
    const [a, b] = g.lanes[0]!;
    expect(travelTicks(g, a, b)).toBe(Math.max(1, Math.ceil(laneLength(g, a, b) / 3)));
  });
});

describe('expeditions', () => {
  it('validates targets', () => {
    const g = game();
    const home = g.galaxy.systems.find((s) => s.homeOf === 'terran')!;
    expect(checkExpedition(g, 'terran', home.id)).toEqual({
      ok: false,
      reason: 'System already surveyed.',
    });
    const unknown = Object.keys(g.systemStates).find(
      (k) => explorationOf(g.systemStates[k], 'terran') === 'unknown',
    )!;
    expect(checkExpedition(g, 'terran', unknown).ok).toBe(false);
    const target = detectedTarget(g, 'terran');
    expect(checkExpedition(g, 'terran', target.id).ok).toBe(true);
  });

  it('charges credits, creates a fleet and blocks duplicates', () => {
    const g = game();
    const target = detectedTarget(g, 'terran');
    const next = launch(g, 'terran', target.id);
    expect(next.factions.terran.resources.credits).toBe(300 - EXPEDITION_COST.credits);
    expect(Object.values(next.fleets)).toHaveLength(1);
    expect(next.events.at(-1)!.kind).toBe('exploration');
    expect(checkExpedition(next, 'terran', target.id)).toEqual({
      ok: false,
      reason: 'An expedition is already en route.',
    });
  });

  it('rejects when credits are insufficient', () => {
    const g = game();
    const target = detectedTarget(g, 'terran');
    const poor: GameState = {
      ...g,
      factions: {
        ...g.factions,
        terran: { ...g.factions.terran, resources: { credits: 10, minerals: 0, research: 0 } },
      },
    };
    expect(checkExpedition(poor, 'terran', target.id)).toEqual({
      ok: false,
      reason: 'Insufficient resources.',
    });
  });

  it('moves along the route and surveys the target on arrival', () => {
    const g = game();
    const target = detectedTarget(g, 'terran');
    let s = launch(g, 'terran', target.id);
    const fleet = Object.values(s.fleets)[0]!;
    const eta = checkExpedition(g, 'terran', target.id);
    if (!eta.ok) throw new Error('unexpected');

    s = advance(s, 1);
    const moving = Object.values(s.fleets)[0];
    expect(moving).toBeDefined();
    expect(
      moving!.progress + (moving!.fromId === fleet.fromId ? 0 : fleet.legTicks),
    ).toBeGreaterThan(0);

    s = advance(s, eta.plan.eta - 1);
    expect(Object.keys(s.fleets)).toHaveLength(0);
    expect(explorationOf(s.systemStates[target.id], 'terran')).toBe('explored');
    expect(s.events.some((e) => e.message.includes(`surveyed ${target.name}`))).toBe(true);
    // Neighbours of the surveyed system become detected.
    for (const [a, b] of s.galaxy.lanes) {
      const other = a === target.id ? b : b === target.id ? a : null;
      if (other) expect(explorationOf(s.systemStates[other], 'terran')).not.toBe('unknown');
    }
  });

  it('exploration is per faction: others learn nothing', () => {
    const g = game();
    const target = detectedTarget(g, 'terran');
    const s = advance(launch(g, 'terran', target.id), 40);
    expect(explorationOf(s.systemStates[target.id], 'terran')).toBe('explored');
    expect(explorationOf(s.systemStates[target.id], 'helion')).toBe(
      explorationOf(g.systemStates[target.id], 'helion'),
    );
  });

  it('awards research for ancient structures', () => {
    const g = game();
    const target = detectedTarget(g, 'terran');
    const withAnomaly = (has: boolean): GameState => ({
      ...g,
      galaxy: {
        ...g.galaxy,
        systems: g.galaxy.systems.map((s) => (s.id === target.id ? { ...s, hasAnomaly: has } : s)),
      },
    });
    const baseline = advance(launch(withAnomaly(false), 'terran', target.id), 40);
    const s = advance(launch(withAnomaly(true), 'terran', target.id), 40);
    expect(baseline.events.some((e) => e.kind === 'discovery')).toBe(false);
    expect(s.events.some((e) => e.kind === 'discovery')).toBe(true);
    expect(s.factions.terran.resources.research - baseline.factions.terran.resources.research).toBe(
      ANOMALY_RESEARCH_REWARD,
    );
  });

  it('interpolates fleet position along the current leg', () => {
    const g = game();
    const target = detectedTarget(g, 'terran');
    const s = launch(g, 'terran', target.id);
    const f = Object.values(s.fleets)[0]!;
    const start = g.galaxy.systems.find((x) => x.id === f.fromId)!.position;
    expect(fleetPosition(g.galaxy, f)).toEqual(start);
    const end = g.galaxy.systems.find((x) => x.id === f.toId)!.position;
    expect(fleetPosition(g.galaxy, { ...f, progress: f.legTicks })).toEqual(end);
  });

  it('is deterministic', () => {
    const run = () => {
      const g = game();
      return advance(launch(g, 'terran', detectedTarget(g, 'terran').id), 30);
    };
    expect(run()).toEqual(run());
  });
});
