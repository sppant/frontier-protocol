import { FACTION_IDS } from '@/domain/factions';
import type {
  FactionId,
  Galaxy,
  Planet,
  PlanetType,
  StarClass,
  StarSystem,
  SystemState,
  Vec3,
} from '@/domain/types';
import { createRng, type Rng } from './rng';

const PREFIXES = [
  'Ar',
  'Bel',
  'Cor',
  'Dra',
  'El',
  'Fen',
  'Gal',
  'Hy',
  'Ix',
  'Kal',
  'Lyr',
  'Mer',
  'Nov',
  'Or',
  'Pyr',
  'Quor',
  'Ser',
  'Tal',
  'Ur',
  'Vey',
  'Xan',
  'Zeph',
];
const SUFFIXES = ['ion', 'ara', 'ex', 'os', 'ia', 'um', 'is', 'ar', 'on', 'eth', 'ys', 'ora'];
const STAR_CLASSES: StarClass[] = ['red', 'orange', 'yellow', 'white', 'blue'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export const DEFAULT_SYSTEM_COUNT = 16;
const GALAXY_RADIUS = 24;
const MIN_SYSTEM_DISTANCE = 6;

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function placeSystems(rng: Rng, count: number): Vec3[] {
  const points: Vec3[] = [];
  let attempts = 0;
  let minDist = MIN_SYSTEM_DISTANCE;
  while (points.length < count) {
    // Relax spacing if the disc is too crowded so generation always terminates.
    if (++attempts % 400 === 0) minDist *= 0.9;
    const r = GALAXY_RADIUS * Math.sqrt(rng.next());
    const theta = rng.float(0, Math.PI * 2);
    const p: Vec3 = [r * Math.cos(theta), rng.float(-2, 2), r * Math.sin(theta)];
    if (points.every((q) => dist(p, q) >= minDist)) points.push(p);
  }
  return points;
}

function buildLanes(positions: Vec3[], ids: string[]): [string, string][] {
  const keys = new Set<string>();
  const lanes: [string, string][] = [];
  const add = (i: number, j: number) => {
    const [lo, hi] = i < j ? [i, j] : [j, i];
    const key = `${lo}:${hi}`;
    if (i === j || keys.has(key)) return;
    keys.add(key);
    lanes.push([ids[lo] as string, ids[hi] as string]);
  };
  // Each system links to its two nearest neighbours.
  positions.forEach((p, i) => {
    positions
      .map((q, j) => ({ j, d: dist(p, q) }))
      .filter((n) => n.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .forEach((n) => add(i, n.j));
  });
  // Join disconnected components with their shortest bridge.
  const parent = positions.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r] as number;
    parent[x] = r;
    return r;
  };
  const index = new Map(ids.map((id, i) => [id, i]));
  for (const [a, b] of lanes) parent[find(index.get(a) as number)] = find(index.get(b) as number);
  for (;;) {
    let best: { i: number; j: number; d: number } | null = null;
    positions.forEach((p, i) =>
      positions.forEach((q, j) => {
        if (find(i) === find(j)) return;
        const d = dist(p, q);
        if (!best || d < best.d) best = { i, j, d };
      }),
    );
    if (!best) break;
    const { i, j } = best as { i: number; j: number };
    add(i, j);
    parent[find(i)] = find(j);
  }
  return lanes;
}

function pickHomes(positions: Vec3[], rng: Rng): number[] {
  const homes = [rng.int(0, positions.length - 1)];
  while (homes.length < FACTION_IDS.length) {
    let best = -1;
    let bestD = -1;
    positions.forEach((p, i) => {
      if (homes.includes(i)) return;
      const d = Math.min(...homes.map((h) => dist(p, positions[h] as Vec3)));
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    });
    homes.push(best);
  }
  return homes;
}

function makePlanet(rng: Rng, systemId: string, systemName: string, orbit: number): Planet {
  const types: PlanetType[] =
    orbit >= 2
      ? ['barren', 'terran', 'ocean', 'desert', 'ice', 'gas', 'volcanic', 'gas', 'ice']
      : ['barren', 'terran', 'ocean', 'desert', 'volcanic'];
  const type = rng.pick(types);
  const habitability: Record<PlanetType, number> = {
    terran: rng.int(65, 95),
    ocean: rng.int(50, 80),
    desert: rng.int(25, 50),
    ice: rng.int(10, 35),
    volcanic: rng.int(0, 20),
    barren: rng.int(0, 15),
    gas: 0,
  };
  return {
    id: `${systemId}-p${orbit}`,
    systemId,
    name: `${systemName} ${ROMAN[orbit] ?? orbit + 1}`,
    type,
    size: type === 'gas' ? 3 : (rng.int(1, 3) as 1 | 2 | 3),
    habitability: habitability[type],
    minerals: rng.int(1, 5),
  };
}

/** Generate a deterministic galaxy from a seed. */
export function generateGalaxy(seed: number, systemCount = DEFAULT_SYSTEM_COUNT): Galaxy {
  if (systemCount < FACTION_IDS.length)
    throw new Error('Galaxy needs at least one system per faction');
  const rng = createRng(seed);
  const positions = placeSystems(rng, systemCount);
  const homeIdx = pickHomes(positions, rng);
  const homeFactions = rng.shuffle(FACTION_IDS);

  const usedNames = new Set<string>();
  const systems: StarSystem[] = [];
  const planets: Planet[] = [];

  positions.forEach((position, i) => {
    let name: string;
    do {
      name = rng.pick(PREFIXES) + rng.pick(SUFFIXES);
    } while (usedNames.has(name));
    usedNames.add(name);

    const id = `sys-${i}`;
    const homeSlot = homeIdx.indexOf(i);
    const homeOf: FactionId | null = homeSlot >= 0 ? (homeFactions[homeSlot] as FactionId) : null;
    const count = homeOf ? rng.int(3, 5) : rng.int(1, 5);
    const sysPlanets = Array.from({ length: count }, (_, orbit) =>
      makePlanet(rng, id, name, orbit),
    );
    if (homeOf) {
      // Every capital has a habitable homeworld.
      const home = sysPlanets[0] as Planet;
      home.type = 'terran';
      home.habitability = 90;
      home.size = 2;
      home.minerals = 3;
    }
    planets.push(...sysPlanets);
    systems.push({
      id,
      name,
      position,
      starClass: rng.pick(STAR_CLASSES),
      planetIds: sysPlanets.map((p) => p.id),
      hasAnomaly: !homeOf && rng.chance(0.2),
      homeOf,
    });
  });

  return {
    seed,
    systems,
    planets,
    lanes: buildLanes(
      positions,
      systems.map((s) => s.id),
    ),
  };
}

/** Starting ownership and fog of war: each faction knows its capital and the systems beside it. */
export function createInitialSystemStates(galaxy: Galaxy): Record<string, SystemState> {
  const states: Record<string, SystemState> = {};
  for (const s of galaxy.systems) {
    const exploration = Object.fromEntries(
      FACTION_IDS.map((f) => [f, 'unknown']),
    ) as SystemState['exploration'];
    states[s.id] = { exploration, ownerId: s.homeOf };
  }
  for (const home of galaxy.systems) {
    if (!home.homeOf) continue;
    const f = home.homeOf;
    (states[home.id] as SystemState).exploration[f] = 'explored';
    for (const [a, b] of galaxy.lanes) {
      const other = a === home.id ? b : b === home.id ? a : null;
      const st = other ? states[other] : undefined;
      if (st && st.exploration[f] === 'unknown') st.exploration[f] = 'detected';
    }
  }
  return states;
}
