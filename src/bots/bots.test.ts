import { describe, expect, it } from 'vitest';
import type { Difficulty, Personality } from '@/domain/bots';
import { FACTION_IDS } from '@/domain/factions';
import type { GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { advanceGame, newGame, step, withBots } from '@/engine/step';
import { factionReport } from '@/sim/economy';
import { createGame } from '@/sim/state';
import { EVENTS_BY_ID } from '@/domain/events';
import { checkEventChoice, resolveEvent } from '@/sim/events';
import { generateCandidates } from './candidates';
import { DIFFICULTIES, MIN_UTILITY, PERSONALITIES } from './personalities';

/** Resolve pending player events with the first affordable choice so time keeps flowing. */
function play(state: GameState, days: number): GameState {
  let s = state;
  for (let i = 0; i < days && !s.victory; i++) {
    s = step(s);
    if (s.pendingEvent) {
      const def = EVENTS_BY_ID[s.pendingEvent.eventId]!;
      const choice = def.choices.find((c) => checkEventChoice(s, c.id).ok);
      s = choice
        ? (resolveEvent(s, choice.id) as { state: GameState }).state
        : { ...s, pendingEvent: null };
    }
  }
  return s;
}

const allBots = (seed: number, difficulty: Difficulty, personalities = {}) =>
  withBots(createGame(seed, 'terran'), difficulty, FACTION_IDS, personalities);

function buildingCount(s: GameState, f: FactionId, b: string) {
  return Object.values(s.colonies)
    .filter((c) => c.ownerId === f)
    .reduce((n, c) => n + c.buildings.filter((x) => x === b).length, 0);
}

describe('bot setup', () => {
  it('newGame gives the three rival factions bots and leaves the player human', () => {
    const g = newGame(2479, 'helion', 'normal');
    expect(Object.keys(g.bots).sort()).toEqual(['oracle', 'terran', 'veydran']);
    expect(g.bots.helion).toBeUndefined();
    expect(g.bots.veydran?.personality).toBe('warlord');
    expect(g.bots.terran?.nextDecisionTick).not.toBe(g.bots.veydran?.nextDecisionTick);
  });

  it('defines four distinct personalities', () => {
    const w = Object.values(PERSONALITIES).map((p) => JSON.stringify(p.weights));
    expect(new Set(w).size).toBe(4);
  });
});

describe('determinism', () => {
  it('same seed and difficulty ⇒ identical game state', () => {
    expect(play(allBots(11, 'normal'), 150)).toEqual(play(allBots(11, 'normal'), 150));
  });

  it('different seeds diverge', () => {
    expect(play(allBots(11, 'normal'), 100)).not.toEqual(play(allBots(12, 'normal'), 100));
  });
});

describe('decision timing and logs', () => {
  it('bots only decide on their schedule', () => {
    const s = play(allBots(5, 'normal'), 120);
    for (const f of FACTION_IDS) {
      const bot = s.bots[f]!;
      const ticks = [...new Set(bot.log.map((e) => e.tick))];
      expect(ticks.length).toBeGreaterThan(3);
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i]! - ticks[i - 1]!).toBeGreaterThanOrEqual(DIFFICULTIES.normal.interval);
      }
      expect(Math.min(...ticks)).toBeGreaterThanOrEqual(DIFFICULTIES.normal.interval);
    }
  });

  it('logs explainable entries with bounded alternatives', () => {
    const s = play(allBots(5, 'hard'), 120);
    const entries = Object.values(s.bots).flatMap((b) => b!.log);
    expect(entries.length).toBeGreaterThan(20);
    for (const e of entries) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.reason.length).toBeGreaterThan(0);
      expect(e.utility).toBeGreaterThanOrEqual(MIN_UTILITY);
      expect(e.alternatives.length).toBeLessThanOrEqual(3);
      for (const alt of e.alternatives) expect(alt.utility).toBeLessThanOrEqual(e.utility + 0.5);
    }
  });

  it('caps log size and respects actions-per-decision', () => {
    const s = play(allBots(5, 'hard'), 300);
    for (const b of Object.values(s.bots)) expect(b!.log.length).toBeLessThanOrEqual(60);
    const perTick = new Map<string, number>();
    for (const e of Object.values(s.bots).flatMap((b) => b!.log)) {
      const k = `${e.factionId}@${e.tick}`;
      perTick.set(k, (perTick.get(k) ?? 0) + 1);
    }
    for (const n of perTick.values()) expect(n).toBeLessThanOrEqual(DIFFICULTIES.hard.actions);
  });

  it('bots hold their turn while the player has a decision pending', () => {
    const s = allBots(5, 'normal');
    const waiting = advanceGame({ ...s, tick: 40 }, 1);
    expect(waiting.pendingEvent).not.toBeNull();
    const before = Object.values(waiting.bots).flatMap((b) => b!.log).length;
    expect(before).toBe(0);
  });
});

describe('difficulty changes decisions, not resources', () => {
  it('all difficulties start with identical economies', () => {
    const reports = (['easy', 'normal', 'hard'] as const).map((d) =>
      FACTION_IDS.map((f) => factionReport(allBots(5, d), f).net),
    );
    expect(reports[1]).toEqual(reports[0]);
    expect(reports[2]).toEqual(reports[0]);
  });

  it('harder bots make more decisions in the same time', () => {
    const count = (d: Difficulty) =>
      Object.values(play(allBots(5, d), 100).bots).reduce((n, b) => n + b!.log.length, 0);
    expect(count('hard')).toBeGreaterThan(count('easy'));
    expect(count('normal')).toBeGreaterThan(count('easy'));
  });
});

describe('fair play invariants', () => {
  it('resources never go negative and colonies stay consistent', () => {
    let s = allBots(3, 'hard');
    for (let i = 0; i < 400 && !s.victory; i++) {
      s = play(s, 1);
      for (const f of FACTION_IDS) {
        const r = s.factions[f].resources;
        expect(r.credits).toBeGreaterThanOrEqual(0);
        expect(r.minerals).toBeGreaterThanOrEqual(0);
        expect(r.research).toBeGreaterThanOrEqual(0);
      }
      for (const c of Object.values(s.colonies)) {
        expect(s.systemStates[c.systemId]!.ownerId).toBe(c.ownerId);
      }
    }
  });

  it('bots only claim systems in the manner the rules allow (no ownership flips)', () => {
    const start = allBots(3, 'hard');
    const end = play(start, 300);
    for (const sys of start.galaxy.systems) {
      if (sys.homeOf) expect(end.systemStates[sys.id]!.ownerId).toBe(sys.homeOf);
    }
  });
});

describe('bots progress', () => {
  it.each(['pioneer', 'merchant', 'warlord', 'oracle'] as const)(
    '%s expands, builds and researches',
    (p) => {
      const s = play(allBots(2479, 'normal', { terran: p }), 200);
      const colonies = Object.values(s.colonies).filter((c) => c.ownerId === 'terran').length;
      const buildings = Object.values(s.colonies)
        .filter((c) => c.ownerId === 'terran')
        .reduce((n, c) => n + c.buildings.length, 0);
      expect(colonies + buildings + s.factions.terran.techs.length).toBeGreaterThan(4);
      expect(s.bots.terran!.log.length).toBeGreaterThan(5);
    },
  );
});

describe('late-game options', () => {
  it('bots upgrade buildings, research the new techs and terraform', () => {
    const s = play(allBots(2479, 'hard'), 450);
    const colonies = Object.values(s.colonies);
    expect(colonies.some((c) => Object.values(c.upgrades).some((n) => (n ?? 0) > 0))).toBe(true);
    const techs = FACTION_IDS.flatMap((f) => s.factions[f].techs);
    expect(techs).toContain('terraforming');
    expect(colonies.some((c) => c.terraform > 0)).toBe(true);
  });
});

describe('personalities produce different behaviour', () => {
  const run = (p: Personality) => {
    const totals = { labs: 0, hubs: 0, mines: 0, colonies: 0, explore: 0, techs: 0 };
    for (const seed of [1, 2, 3, 4]) {
      const s = play(allBots(seed, 'normal', { terran: p }), 160);
      totals.labs += buildingCount(s, 'terran', 'lab');
      totals.hubs += buildingCount(s, 'terran', 'tradeHub');
      totals.mines += buildingCount(s, 'terran', 'mine');
      totals.colonies += Object.values(s.colonies).filter((c) => c.ownerId === 'terran').length;
      totals.explore += s.bots.terran!.log.filter((e) => e.action.kind === 'expedition').length;
      totals.techs += s.factions.terran.techs.length;
    }
    return totals;
  };

  it('oracles favour labs and research over warlords', () => {
    const oracle = run('oracle');
    const warlord = run('warlord');
    expect(oracle.labs).toBeGreaterThan(warlord.labs);
    expect(oracle.techs).toBeGreaterThanOrEqual(warlord.techs);
  });

  it('warlords favour mines over oracles', () => {
    expect(run('warlord').mines).toBeGreaterThanOrEqual(run('oracle').mines);
  });

  it('merchants favour trade hubs over pioneers; pioneers explore more', () => {
    const merchant = run('merchant');
    const pioneer = run('pioneer');
    expect(merchant.hubs).toBeGreaterThanOrEqual(pioneer.hubs);
    expect(pioneer.explore).toBeGreaterThanOrEqual(merchant.explore);
  });
});

describe('candidate rules', () => {
  it('does not offer colonization that would strand the bot without mine minerals', () => {
    const base = allBots(2479, 'normal');
    const explored: GameState = {
      ...base,
      systemStates: Object.fromEntries(
        Object.entries(base.systemStates).map(([id, st]) => [
          id,
          { ...st, exploration: { ...st.exploration, terran: 'explored' as const } },
        ]),
      ),
    };
    const ctx = {
      factionId: 'terran' as const,
      weights: PERSONALITIES.pioneer.weights,
      objective: null,
      reserve: 0,
      capstoneChain: new Set<string>(),
    };
    const withMinerals = (m: number): GameState => ({
      ...explored,
      factions: {
        ...explored.factions,
        terran: {
          ...explored.factions.terran,
          resources: { credits: 1000, minerals: m, research: 0 },
        },
      },
    });
    const kinds = (s: GameState) => generateCandidates(s, ctx).map((c) => c.action.kind);
    expect(kinds(withMinerals(500))).toContain('colonize');
    expect(kinds(withMinerals(60))).not.toContain('colonize'); // would leave < one mine's worth
  });

  it('is deterministic for a given state', () => {
    const g = allBots(2479, 'normal');
    const ctx = {
      factionId: 'terran' as const,
      weights: PERSONALITIES.merchant.weights,
      objective: null,
      reserve: 0,
      capstoneChain: new Set<string>(),
    };
    expect(generateCandidates(g, ctx)).toEqual(generateCandidates(g, ctx));
  });
});

describe('engine', () => {
  it('a batched advance stops at the first pending decision', () => {
    const s = advanceGame(allBots(2, 'normal'), 10);
    expect(s.pendingEvent?.eventId).toBe('firstContact');
    expect(s.tick).toBe(1);
  });

  it('stops the bots when the match is over', () => {
    const s = allBots(2, 'normal');
    const over: GameState = { ...s, victory: { winner: 'terran', kind: 'score', tick: 0 } };
    expect(step(over)).toBe(over);
  });
});
