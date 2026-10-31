import { EVENTS_BY_ID } from '@/domain/events';
import { BUILDINGS } from '@/domain/buildings';
import { FACTION_IDS } from '@/domain/factions';
import { SAVE_VERSION, type GameState } from '@/domain/game';
import { TECH_BY_ID } from '@/domain/techs';

/** Thrown for any save that is unreadable, corrupt, or from an unsupported version. */
export class SaveError extends Error {
  override name = 'SaveError';
}

type Obj = Record<string, unknown>;

const fail = (path: string, expected: string): never => {
  throw new SaveError(`Invalid save: ${path} should be ${expected}.`);
};

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const obj = (v: unknown, path: string): Obj => (isObj(v) ? v : fail(path, 'an object'));
const arr = (v: unknown, path: string): unknown[] =>
  Array.isArray(v) ? v : fail(path, 'an array');
const str = (v: unknown, path: string): string =>
  typeof v === 'string' ? v : fail(path, 'a string');
const bool = (v: unknown, path: string): boolean =>
  typeof v === 'boolean' ? v : fail(path, 'a boolean');
const num = (v: unknown, path: string): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fail(path, 'a finite number');
const nonNeg = (v: unknown, path: string): number => {
  const n = num(v, path);
  return n >= 0 ? n : fail(path, 'a non-negative number');
};
const oneOf = <T extends string>(v: unknown, options: readonly T[], path: string): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v)
    ? (v as T)
    : fail(path, `one of ${options.join(', ')}`);
const nullable = <T>(v: unknown, read: (x: unknown) => T): T | null =>
  v === null ? null : read(v);

const FACTIONS_LIST = FACTION_IDS as readonly string[];
const EXPLORATION = ['unknown', 'detected', 'explored'] as const;
const STAR_CLASSES = ['red', 'orange', 'yellow', 'white', 'blue'] as const;
const PLANET_TYPES = ['barren', 'terran', 'ocean', 'desert', 'ice', 'gas', 'volcanic'] as const;
const EVENT_KINDS = [
  'colony',
  'construction',
  'economy',
  'exploration',
  'discovery',
  'research',
  'story',
  'victory',
] as const;
const PERSONALITY = ['pioneer', 'merchant', 'warlord', 'oracle'] as const;
const DIFFICULTY = ['easy', 'normal', 'hard'] as const;
const OBJECTIVE = ['ascendancy', 'dominion'] as const;
const VICTORY = ['ascendancy', 'dominion', 'score'] as const;
const MAX_STORY_STAGE = 6;

const faction = (v: unknown, path: string) => oneOf(v, FACTION_IDS, path);

function ref(ids: Set<string>, v: unknown, path: string, what: string): string {
  const id = str(v, path);
  return ids.has(id) ? id : fail(path, `a known ${what} id (got "${id}")`);
}

/**
 * Runtime validation of untrusted save data (structure, value ranges and
 * referential integrity). Returns the same object, typed, or throws SaveError.
 */
export function validateGameState(value: unknown): GameState {
  const g = obj(value, 'game');
  if (g.version !== SAVE_VERSION) fail('game.version', `${SAVE_VERSION}`);
  num(g.seed, 'game.seed');
  nonNeg(g.tick, 'game.tick');
  faction(g.playerFaction, 'game.playerFaction');

  // Galaxy
  const galaxy = obj(g.galaxy, 'game.galaxy');
  num(galaxy.seed, 'game.galaxy.seed');
  const systemIds = new Set<string>();
  arr(galaxy.systems, 'game.galaxy.systems').forEach((raw, i) => {
    const p = `game.galaxy.systems[${i}]`;
    const s = obj(raw, p);
    systemIds.add(str(s.id, `${p}.id`));
    str(s.name, `${p}.name`);
    const pos = arr(s.position, `${p}.position`);
    if (pos.length !== 3) fail(`${p}.position`, 'a 3-number array');
    pos.forEach((n, j) => num(n, `${p}.position[${j}]`));
    oneOf(s.starClass, STAR_CLASSES, `${p}.starClass`);
    arr(s.planetIds, `${p}.planetIds`).forEach((id, j) => str(id, `${p}.planetIds[${j}]`));
    bool(s.hasAnomaly, `${p}.hasAnomaly`);
    nullable(s.homeOf, (x) => faction(x, `${p}.homeOf`));
  });
  if (systemIds.size === 0) fail('game.galaxy.systems', 'non-empty');

  const planetIds = new Set<string>();
  const planetSystem = new Map<string, string>();
  arr(galaxy.planets, 'game.galaxy.planets').forEach((raw, i) => {
    const p = `game.galaxy.planets[${i}]`;
    const pl = obj(raw, p);
    const id = str(pl.id, `${p}.id`);
    planetIds.add(id);
    planetSystem.set(id, ref(systemIds, pl.systemId, `${p}.systemId`, 'system'));
    str(pl.name, `${p}.name`);
    oneOf(pl.type, PLANET_TYPES, `${p}.type`);
    if (![1, 2, 3].includes(pl.size as number)) fail(`${p}.size`, '1, 2 or 3');
    nonNeg(pl.habitability, `${p}.habitability`);
    nonNeg(pl.minerals, `${p}.minerals`);
  });
  arr(galaxy.systems, 'game.galaxy.systems').forEach((s, i) =>
    arr((s as Obj).planetIds, `game.galaxy.systems[${i}].planetIds`).forEach((id, j) =>
      ref(planetIds, id, `game.galaxy.systems[${i}].planetIds[${j}]`, 'planet'),
    ),
  );
  arr(galaxy.lanes, 'game.galaxy.lanes').forEach((raw, i) => {
    const lane = arr(raw, `game.galaxy.lanes[${i}]`);
    if (lane.length !== 2) fail(`game.galaxy.lanes[${i}]`, 'a pair of system ids');
    ref(systemIds, lane[0], `game.galaxy.lanes[${i}][0]`, 'system');
    ref(systemIds, lane[1], `game.galaxy.lanes[${i}][1]`, 'system');
  });

  // Per-system state
  const states = obj(g.systemStates, 'game.systemStates');
  for (const id of systemIds) {
    const p = `game.systemStates.${id}`;
    const st = obj(states[id], p);
    nullable(st.ownerId, (x) => faction(x, `${p}.ownerId`));
    const ex = obj(st.exploration, `${p}.exploration`);
    for (const f of FACTION_IDS) oneOf(ex[f], EXPLORATION, `${p}.exploration.${f}`);
  }

  // Factions
  const factions = obj(g.factions, 'game.factions');
  for (const f of FACTION_IDS) {
    const p = `game.factions.${f}`;
    const fs = obj(factions[f], p);
    if (fs.id !== f) fail(`${p}.id`, `"${f}"`);
    const r = obj(fs.resources, `${p}.resources`);
    for (const k of ['credits', 'minerals', 'research']) nonNeg(r[k], `${p}.resources.${k}`);
    bool(fs.deficit, `${p}.deficit`);
    arr(fs.techs, `${p}.techs`).forEach((t, j) => {
      if (typeof t !== 'string' || !TECH_BY_ID[t]) fail(`${p}.techs[${j}]`, 'a known technology');
    });
    nullable(fs.attunementDone, (x) => num(x, `${p}.attunementDone`));
  }

  // Colonies
  const colonies = obj(g.colonies, 'game.colonies');
  for (const [key, raw] of Object.entries(colonies)) {
    const p = `game.colonies.${key}`;
    const c = obj(raw, p);
    if (c.id !== key) fail(`${p}.id`, `"${key}"`);
    const planetId = ref(planetIds, c.planetId, `${p}.planetId`, 'planet');
    if (c.systemId !== planetSystem.get(planetId)) fail(`${p}.systemId`, "the planet's system");
    faction(c.ownerId, `${p}.ownerId`);
    nonNeg(c.population, `${p}.population`);
    arr(c.buildings, `${p}.buildings`).forEach((b, j) =>
      oneOf(b, Object.keys(BUILDINGS), `${p}.buildings[${j}]`),
    );
    arr(c.queue, `${p}.queue`).forEach((raw2, j) => {
      const q = obj(raw2, `${p}.queue[${j}]`);
      oneOf(q.building, Object.keys(BUILDINGS), `${p}.queue[${j}].building`);
      nonNeg(q.remaining, `${p}.queue[${j}].remaining`);
    });
  }

  // Fleets
  for (const [key, raw] of Object.entries(obj(g.fleets, 'game.fleets'))) {
    const p = `game.fleets.${key}`;
    const f = obj(raw, p);
    if (f.id !== key) fail(`${p}.id`, `"${key}"`);
    faction(f.ownerId, `${p}.ownerId`);
    if (f.kind !== 'scout') fail(`${p}.kind`, '"scout"');
    ref(systemIds, f.fromId, `${p}.fromId`, 'system');
    ref(systemIds, f.toId, `${p}.toId`, 'system');
    ref(systemIds, f.targetId, `${p}.targetId`, 'system');
    arr(f.remainingPath, `${p}.remainingPath`).forEach((id, j) =>
      ref(systemIds, id, `${p}.remainingPath[${j}]`, 'system'),
    );
    nonNeg(f.progress, `${p}.progress`);
    if (nonNeg(f.legTicks, `${p}.legTicks`) < 1) fail(`${p}.legTicks`, 'at least 1');
    if (nonNeg(f.speed, `${p}.speed`) <= 0) fail(`${p}.speed`, 'positive');
  }
  nonNeg(g.nextFleetId, 'game.nextFleetId');

  // Events & story
  arr(g.events, 'game.events').forEach((raw, i) => {
    const p = `game.events[${i}]`;
    const e = obj(raw, p);
    str(e.id, `${p}.id`);
    nonNeg(e.tick, `${p}.tick`);
    oneOf(e.kind, EVENT_KINDS, `${p}.kind`);
    faction(e.factionId, `${p}.factionId`);
    str(e.message, `${p}.message`);
  });
  nonNeg(g.nextEventId, 'game.nextEventId');
  num(g.rngState, 'game.rngState');
  nullable(g.pendingEvent, (x) => {
    const pe = obj(x, 'game.pendingEvent');
    if (typeof pe.eventId !== 'string' || !EVENTS_BY_ID[pe.eventId]) {
      fail('game.pendingEvent.eventId', 'a known event');
    }
    nonNeg(pe.tick, 'game.pendingEvent.tick');
    return pe;
  });
  arr(g.seenEvents, 'game.seenEvents').forEach((id, i) => str(id, `game.seenEvents[${i}]`));
  if (
    !Number.isInteger(g.storyStage) ||
    (g.storyStage as number) < 0 ||
    (g.storyStage as number) > MAX_STORY_STAGE
  ) {
    fail('game.storyStage', `an integer from 0 to ${MAX_STORY_STAGE}`);
  }
  nullable(g.victory, (x) => {
    const v = obj(x, 'game.victory');
    faction(v.winner, 'game.victory.winner');
    oneOf(v.kind, VICTORY, 'game.victory.kind');
    nonNeg(v.tick, 'game.victory.tick');
    return v;
  });

  // Standings history
  arr(g.history, 'game.history').forEach((raw, i) => {
    const p = `game.history[${i}]`;
    const h = obj(raw, p);
    nonNeg(h.tick, `${p}.tick`);
    const scores = obj(h.scores, `${p}.scores`);
    for (const f of FACTION_IDS) num(scores[f], `${p}.scores.${f}`);
  });

  // Bots
  for (const [f, raw] of Object.entries(obj(g.bots, 'game.bots'))) {
    const p = `game.bots.${f}`;
    if (!FACTIONS_LIST.includes(f)) fail(p, 'keyed by a faction id');
    const b = obj(raw, p);
    oneOf(b.personality, PERSONALITY, `${p}.personality`);
    oneOf(b.difficulty, DIFFICULTY, `${p}.difficulty`);
    num(b.rngState, `${p}.rngState`);
    nonNeg(b.nextDecisionTick, `${p}.nextDecisionTick`);
    nullable(b.objective, (x) => oneOf(x, OBJECTIVE, `${p}.objective`));
    arr(b.log, `${p}.log`).forEach((raw2, j) => {
      const e = obj(raw2, `${p}.log[${j}]`);
      str(e.label, `${p}.log[${j}].label`);
      str(e.reason, `${p}.log[${j}].reason`);
      obj(e.action, `${p}.log[${j}].action`);
    });
  }

  return value as GameState;
}
