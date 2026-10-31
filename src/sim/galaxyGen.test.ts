import { describe, expect, it } from 'vitest';
import { FACTION_IDS } from '@/domain/factions';
import { createRng } from './rng';
import { createInitialSystemStates, generateGalaxy } from './galaxyGen';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('int stays in range and shuffle keeps elements', () => {
    const r = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('generateGalaxy', () => {
  it('is deterministic', () => {
    expect(generateGalaxy(2479)).toEqual(generateGalaxy(2479));
    expect(generateGalaxy(2479)).not.toEqual(generateGalaxy(2480));
  });

  it('produces unique ids and names and valid planet references', () => {
    const g = generateGalaxy(2479, 18);
    expect(g.systems).toHaveLength(18);
    expect(new Set(g.systems.map((s) => s.id)).size).toBe(18);
    expect(new Set(g.systems.map((s) => s.name)).size).toBe(18);
    const planetIds = new Set(g.planets.map((p) => p.id));
    expect(planetIds.size).toBe(g.planets.length);
    for (const s of g.systems) for (const id of s.planetIds) expect(planetIds.has(id)).toBe(true);
  });

  it('assigns one distinct capital per faction with a habitable homeworld', () => {
    const g = generateGalaxy(99);
    const homes = g.systems.filter((s) => s.homeOf);
    expect(homes.map((s) => s.homeOf).sort()).toEqual([...FACTION_IDS].sort());
    for (const h of homes) {
      const first = g.planets.find((p) => p.id === h.planetIds[0]);
      expect(first?.type).toBe('terran');
      expect(first?.habitability).toBeGreaterThanOrEqual(90);
    }
  });

  it('connects every system via hyperlanes', () => {
    for (const seed of [1, 2, 3, 2479, 31337]) {
      const g = generateGalaxy(seed);
      const adj = new Map<string, string[]>(g.systems.map((s) => [s.id, []]));
      for (const [a, b] of g.lanes) {
        adj.get(a)?.push(b);
        adj.get(b)?.push(a);
      }
      const seen = new Set<string>();
      const stack = [g.systems[0]?.id as string];
      while (stack.length) {
        const id = stack.pop() as string;
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push(...(adj.get(id) ?? []));
      }
      expect(seen.size).toBe(g.systems.length);
    }
  });
});

describe('createInitialSystemStates', () => {
  it('reveals only the player home and its neighbours', () => {
    const g = generateGalaxy(2479);
    const states = createInitialSystemStates(g, 'terran');
    const home = g.systems.find((s) => s.homeOf === 'terran');
    expect(states[home?.id as string]).toEqual({ exploration: 'explored', ownerId: 'terran' });
    const neighbours = g.lanes
      .filter(([a, b]) => a === home?.id || b === home?.id)
      .map(([a, b]) => (a === home?.id ? b : a));
    for (const n of neighbours) expect(states[n]?.exploration).not.toBe('unknown');
    const revealed = Object.values(states).filter((s) => s.exploration !== 'unknown').length;
    expect(revealed).toBe(1 + new Set(neighbours).size);
  });
});
