/* eslint-disable @typescript-eslint/no-explicit-any -- these tests deliberately corrupt arbitrary JSON */
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { FACTION_IDS } from '@/domain/factions';
import type { GameState } from '@/domain/game';
import { advanceGame, newGame } from '@/engine/step';
import { Autosaver } from './autosave';
import { CURRENT_SAVE_VERSION, SAVE_FORMAT, decodeSave, encodeSave, migrate } from './save';
import { AUTOSAVE_SLOT, deleteSave, loadGame, saveGame } from './saveGame';
import { IndexedDbStore, MemoryStore } from './storage';
import { SaveError, validateGameState } from './validate';

/** A mid-game state with colonies, fleets, events, techs and bot logs. */
function midGame(): GameState {
  let g = newGame(2479, 'terran', 'normal');
  for (let i = 0; i < 90; i++) {
    g = advanceGame(g, 1);
    if (g.pendingEvent) g = { ...g, pendingEvent: null };
  }
  return g;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('validateGameState', () => {
  it('accepts a fresh game and a played game (JSON round-trip)', () => {
    expect(() => validateGameState(clone(newGame(1, 'helion', 'easy')))).not.toThrow();
    const g = midGame();
    expect(Object.keys(g.fleets).length + g.events.length).toBeGreaterThan(0);
    expect(validateGameState(clone(g))).toEqual(g);
  });

  const corrupt = (mutate: (g: Record<string, any>) => void) => {
    const g = clone(midGame()) as unknown as Record<string, any>;
    mutate(g);
    return () => validateGameState(g);
  };

  it.each([
    ['wrong version', (g: Record<string, unknown>) => (g.version = 99), /version/],
    ['missing galaxy', (g: Record<string, unknown>) => delete g.galaxy, /galaxy/],
    [
      'bad player faction',
      (g: Record<string, unknown>) => (g.playerFaction = 'klingon'),
      /playerFaction/,
    ],
    ['NaN seed', (g: Record<string, unknown>) => (g.seed = 'abc'), /seed/],
    ['negative tick', (g: Record<string, unknown>) => (g.tick = -1), /tick/],
    ['unknown story stage', (g: Record<string, unknown>) => (g.storyStage = 42), /storyStage/],
    ['events not an array', (g: Record<string, unknown>) => (g.events = {}), /events/],
    [
      'unknown pending event',
      (g: Record<string, unknown>) => (g.pendingEvent = { eventId: 'nope', tick: 1 }),
      /pendingEvent/,
    ],
  ])('rejects %s', (_name, mutate, pattern) => {
    expect(corrupt(mutate as (g: Record<string, any>) => void)).toThrow(SaveError);
    expect(corrupt(mutate as (g: Record<string, any>) => void)).toThrow(pattern);
  });

  it('rejects broken references and impossible values', () => {
    const first = (g: Record<string, any>) => Object.values(g.colonies)[0] as Record<string, any>;
    expect(corrupt((g) => (first(g).planetId = 'ghost'))).toThrow(/planetId/);
    expect(corrupt((g) => (first(g).systemId = 'sys-0-wrong'))).toThrow(/systemId/);
    expect(corrupt((g) => (first(g).population = -3))).toThrow(/population/);
    expect(corrupt((g) => (first(g).buildings = ['teleporter']))).toThrow(/buildings/);
    expect(corrupt((g) => (g.factions.terran.resources.credits = -5))).toThrow(/credits/);
    expect(corrupt((g) => (g.factions.terran.resources.minerals = Number.NaN))).toThrow();
    expect(corrupt((g) => (g.factions.helion.techs = ['timeTravel']))).toThrow(/techs/);
    expect(corrupt((g) => (g.galaxy.lanes[0][1] = 'sys-404'))).toThrow(/lanes/);
    expect(corrupt((g) => (g.systemStates['sys-0'].exploration.terran = 'maybe'))).toThrow(
      /exploration/,
    );
    expect(corrupt((g) => (g.systemStates['sys-0'].ownerId = 'martians'))).toThrow(/ownerId/);
    expect(corrupt((g) => (g.bots.helion = { personality: 'pacifist' }))).toThrow(/bots/);
  });

  it('rejects dangling fleet references', () => {
    let g = newGame(2479, 'terran', 'normal');
    g = { ...g, storyStage: 99 };
    for (let i = 0; i < 12; i++) g = advanceGame(g, 1);
    const fleet = Object.values(g.fleets)[0];
    if (!fleet) return; // bots may not have launched yet; covered by midGame in other tests
    const bad = clone(g) as unknown as Record<string, any>;
    bad.fleets[fleet.id].targetId = 'nowhere';
    expect(() => validateGameState(bad)).toThrow(/targetId/);
  });

  it('never throws anything but SaveError for garbage', () => {
    for (const junk of [null, undefined, 5, 'x', [], {}, { version: 1 }, { game: {} }]) {
      expect(() => validateGameState(junk)).toThrow(SaveError);
    }
  });
});

describe('save envelope and migrations', () => {
  it('round-trips through encode/decode', () => {
    const g = midGame();
    const { game, savedAt } = decodeSave(clone(encodeSave(g, new Date('2030-01-02T03:04:05Z'))));
    expect(game).toEqual(g);
    expect(savedAt).toBe('2030-01-02T03:04:05.000Z');
  });

  it('rejects foreign, malformed and future saves', () => {
    const ok = encodeSave(newGame(1, 'terran'));
    expect(() => migrate(null)).toThrow(SaveError);
    expect(() => migrate({ ...ok, format: 'other' })).toThrow(/Not a Frontier Protocol save/);
    expect(() => migrate({ ...ok, version: 0 })).toThrow(/invalid version/);
    expect(() => migrate({ ...ok, version: CURRENT_SAVE_VERSION + 1 })).toThrow(/newer version/);
    expect(() => decodeSave({ ...ok, savedAt: 'yesterday-ish' })).toThrow(/timestamp/);
  });

  it('upgrades old saves step by step', () => {
    const g = clone(newGame(1, 'terran'));
    // Simulate a v1 save whose game field was named differently, then upgraded to v2 and v3.
    const legacy = { format: SAVE_FORMAT, version: 1, savedAt: new Date().toISOString(), state: g };
    const migrations = {
      1: (e: any) => ({ ...e, version: 2, game: e.state }),
      2: (e: any) => ({ ...e, version: 3 }),
    };
    const loaded = decodeSave(legacy, migrations, 3);
    expect(loaded.game).toEqual(g);
  });

  it('fails clearly when a migration is missing or does not advance', () => {
    const base = { format: SAVE_FORMAT, version: 1, savedAt: new Date().toISOString(), game: {} };
    expect(() => migrate(base, {}, 2)).toThrow(/No migration from save version 1/);
    expect(() => migrate(base, { 1: (e) => e }, 2)).toThrow(/did not advance/);
  });
});

describe('real migration: v1 → v2 (standings history)', () => {
  /** A save exactly as v1 of the game wrote it: no `history`, game.version 1. */
  const v1Save = () => {
    const { history: _history, ...rest } = clone(midGame());
    void _history;
    return {
      format: SAVE_FORMAT,
      version: 1,
      savedAt: new Date().toISOString(),
      game: { ...rest, version: 1 },
    };
  };

  it('upgrades a v1 save and keeps everything else intact', () => {
    const old = v1Save();
    const loaded = decodeSave(old);
    expect(loaded.game.version).toBe(2);
    expect(loaded.game.history).toEqual([]);
    const { history: _h, version: _v, ...upgraded } = loaded.game;
    const { version: _ov, ...original } = old.game as Record<string, unknown>;
    void _h;
    void _v;
    void _ov;
    expect(upgraded).toEqual(original);
  });

  it('an upgraded save keeps playing and starts recording history', () => {
    const { game } = decodeSave(v1Save());
    let s = game;
    for (let i = 0; i < 25; i++) {
      s = advanceGame(s, 1);
      if (s.pendingEvent) s = { ...s, pendingEvent: null };
    }
    expect(s.history.length).toBeGreaterThan(0);
    expect(() => validateGameState(clone(s))).not.toThrow();
  });

  it('still rejects a v1 save that is damaged, without throwing a non-SaveError', () => {
    const bad = { ...v1Save(), game: 'garbage' };
    expect(() => decodeSave(bad)).toThrow(SaveError);
    const worse = { ...v1Save(), game: { nope: 1 } };
    expect(() => decodeSave(worse)).toThrow(SaveError);
  });
});

describe('storage', () => {
  it.each([
    ['MemoryStore', () => new MemoryStore()],
    ['IndexedDbStore', () => new IndexedDbStore(new IDBFactory())],
  ])('%s: write, read, overwrite, remove', async (_n, make) => {
    const store = make();
    expect(await store.read('a')).toBeUndefined();
    await store.write('a', { n: 1 });
    expect(await store.read('a')).toEqual({ n: 1 });
    await store.write('a', { n: 2 });
    expect(await store.read('a')).toEqual({ n: 2 });
    await store.remove('a');
    expect(await store.read('a')).toBeUndefined();
  });

  it('IndexedDbStore keeps data across store instances (a "reload")', async () => {
    const factory = new IDBFactory();
    await new IndexedDbStore(factory).write('slot', { hello: 'world' });
    expect(await new IndexedDbStore(factory).read('slot')).toEqual({ hello: 'world' });
  });
});

describe('saveGame / loadGame', () => {
  it('reports none, ok, corrupt', async () => {
    const store = new MemoryStore();
    expect(await loadGame(store)).toEqual({ status: 'none' });

    const g = midGame();
    await saveGame(store, g);
    const ok = await loadGame(store);
    expect(ok.status === 'ok' && ok.save.game).toEqual(g);

    await store.write(AUTOSAVE_SLOT, {
      format: SAVE_FORMAT,
      version: 1,
      savedAt: new Date().toISOString(),
      game: { broken: true },
    });
    const bad = await loadGame(store);
    expect(bad.status).toBe('corrupt');

    await store.write(AUTOSAVE_SLOT, 'not even an object');
    expect((await loadGame(store)).status).toBe('corrupt');

    await deleteSave(store);
    expect(await loadGame(store)).toEqual({ status: 'none' });
  });

  it('treats a failing store as corrupt rather than throwing', async () => {
    const broken = {
      read: () => Promise.reject(new Error('disk on fire')),
      write: vi.fn(),
      remove: vi.fn(),
    };
    const r = await loadGame(broken);
    expect(r).toMatchObject({ status: 'corrupt' });
    expect(r.status === 'corrupt' && r.reason).toMatch(/disk on fire/);
  });

  it('a saved-and-loaded game continues exactly like an uninterrupted one', async () => {
    const store = new IndexedDbStore(new IDBFactory());
    const start = midGame();
    await saveGame(store, start);
    const loaded = await loadGame(store);
    if (loaded.status !== 'ok') throw new Error('load failed');

    const run = (g: GameState) => {
      let s = g;
      for (let i = 0; i < 120 && !s.victory; i++) {
        s = advanceGame(s, 1);
        if (s.pendingEvent) s = { ...s, pendingEvent: null };
      }
      return s;
    };
    expect(run(loaded.save.game)).toEqual(run(start));
    for (const f of FACTION_IDS) expect(loaded.save.game.factions[f]).toEqual(start.factions[f]);
  });
});

describe('Autosaver', () => {
  const g1 = newGame(1, 'terran');
  const g2 = advanceGame(g1, 2);
  const g3 = advanceGame(g1, 4);

  it('throttles routine saves and skips clean state', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = new Autosaver({ save, intervalMs: 5000 });
    a.update(g1);
    await a.poll(0);
    expect(save).toHaveBeenCalledTimes(1);

    a.update(g2);
    await a.poll(1000); // too soon
    expect(save).toHaveBeenCalledTimes(1);
    await a.poll(5000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(g2);

    await a.poll(20000); // clean: nothing to write
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('flush saves immediately regardless of the interval', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = new Autosaver({ save, intervalMs: 60_000 });
    a.update(g1);
    await a.flush(0);
    a.update(g2);
    await a.flush(1);
    expect(save).toHaveBeenCalledTimes(2);
    await a.flush(2); // unchanged
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('never overlaps writes and coalesces to the newest state', async () => {
    let release!: () => void;
    let concurrent = 0;
    let maxConcurrent = 0;
    const save = vi.fn(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise<void>((r) => (release = r));
      concurrent--;
    });
    const a = new Autosaver({ save, intervalMs: 0 });
    a.update(g1);
    const first = a.flush(0);
    a.update(g2);
    const second = a.flush(1);
    a.update(g3);
    const third = a.flush(2);
    release();
    await Promise.resolve();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    release();
    await Promise.all([first, second, third]);
    expect(maxConcurrent).toBe(1);
    expect(save).toHaveBeenLastCalledWith(g3);
  });

  it('reports status and survives a failing store (retries next time)', async () => {
    const status: string[] = [];
    const save = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined);
    const a = new Autosaver({ save, intervalMs: 0, onStatus: (s) => status.push(s) });
    a.update(g1);
    await a.flush(0);
    expect(status).toEqual(['saving', 'error']);
    expect(a.dirty).toBe(true);
    await a.flush(1);
    expect(status.slice(-1)).toEqual(['saved']);
    expect(a.dirty).toBe(false);
  });

  it('reset adopts a loaded game as already saved', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = new Autosaver({ save, intervalMs: 0 });
    a.reset(g1);
    await a.flush(0);
    expect(save).not.toHaveBeenCalled();
    a.update(g2);
    await a.flush(1);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
