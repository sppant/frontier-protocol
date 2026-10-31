import { describe, expect, it } from 'vitest';
import { EVENTS_BY_ID, STORY_SCHEDULE } from '@/domain/events';
import { TECHS } from '@/domain/techs';
import type { GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { colonyCapacity } from './economy';
import { checkEventChoice, maybeTriggerEvent, resolveEvent } from './events';
import { modifiersFor, surveyReachFor } from './modifiers';
import { checkResearch, researchTech } from './research';
import { createGame } from './state';
import { advance, tick } from './tick';
import {
  ATTUNEMENT_DAYS,
  DOMINION_SYSTEMS,
  TIME_LIMIT,
  checkVictory,
  score,
  victoryProgress,
} from './victory';

const game = (f: FactionId = 'terran') => createGame(2479, f);
const withResearch = (g: GameState, f: FactionId, research: number): GameState => ({
  ...g,
  factions: {
    ...g.factions,
    [f]: { ...g.factions[f], resources: { ...g.factions[f].resources, research } },
  },
});
const research = (g: GameState, f: FactionId, id: string): GameState => {
  const r = researchTech(g, f, id);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe('technology', () => {
  it('has a consistent tree', () => {
    const ids = new Set(TECHS.map((t) => t.id));
    expect(ids.size).toBe(TECHS.length);
    for (const t of TECHS) for (const r of t.requires) expect(ids.has(r)).toBe(true);
    expect(TECHS.filter((t) => t.capstone)).toHaveLength(1);
  });

  it('spends research and applies modifiers', () => {
    const g = withResearch(game(), 'terran', 100);
    const before = modifiersFor(g, 'terran');
    const s = research(g, 'terran', 'deepCore');
    expect(s.factions.terran.resources.research).toBe(60);
    expect(s.factions.terran.techs).toEqual(['deepCore']);
    expect(modifiersFor(s, 'terran').minerals).toBeCloseTo(before.minerals * 1.25);
    expect(s.events.at(-1)!.kind).toBe('research');
  });

  it('stacks multiple techs multiplicatively', () => {
    let s = withResearch(game(), 'terran', 1000);
    s = research(s, 'terran', 'colonialLogistics');
    s = research(s, 'terran', 'rapidCharters');
    expect(modifiersFor(s, 'terran').colonyCost).toBeCloseTo(0.8 * 0.8 * 0.85);
  });

  it('enforces cost, prerequisites, faction exclusivity, story gating and no repeats', () => {
    const g = game();
    expect(checkResearch(g, 'terran', 'deepCore')).toEqual({
      ok: false,
      reason: 'Needs 40 research.',
    });
    const rich = withResearch(g, 'terran', 9000);
    expect(checkResearch(rich, 'terran', 'fusionGrid')).toEqual({
      ok: false,
      reason: 'Requires Deep Core Extraction.',
    });
    expect(checkResearch(rich, 'terran', 'warEconomy')).toEqual({
      ok: false,
      reason: 'Unavailable to your faction.',
    });
    const s = research(rich, 'terran', 'deepCore');
    expect(checkResearch(s, 'terran', 'deepCore')).toEqual({
      ok: false,
      reason: 'Already researched.',
    });
    expect(checkResearch(rich, 'terran', 'nope').ok).toBe(false);
    expect(researchTech(rich, 'terran', 'fusionGrid').ok).toBe(false);

    let late = rich;
    for (const id of [
      'deepCore',
      'fusionGrid',
      'orbitalMarkets',
      'quantumLabs',
      'expeditionDrives',
      'nexusCartography',
    ]) {
      late = research(late, 'terran', id);
    }
    expect(checkResearch(late, 'terran', 'nexusAttunement')).toEqual({
      ok: false,
      reason: 'The Nexus has not yet awakened.',
    });
    expect(checkResearch({ ...late, storyStage: 6 }, 'terran', 'nexusAttunement').ok).toBe(true);
  });

  it('exploration techs change fleet speed and survey reach', () => {
    let s = withResearch(game(), 'terran', 1000);
    expect(surveyReachFor(s, 'terran')).toBe(1);
    s = research(research(s, 'terran', 'expeditionDrives'), 'terran', 'nexusCartography');
    expect(surveyReachFor(s, 'terran')).toBe(2);
    expect(modifiersFor(s, 'terran').fleetSpeed).toBeCloseTo(1.5);
  });
});

describe('events', () => {
  it('fires the first story event on day 1 and pauses for a decision', () => {
    const s = tick(game());
    expect(s.pendingEvent?.eventId).toBe('firstContact');
    expect(s.storyStage).toBe(1);
  });

  it('does not stack events while one is pending', () => {
    let s = advance(game(), 1);
    const pending = s.pendingEvent;
    s = advance(s, 60);
    expect(s.pendingEvent).toEqual(pending);
    expect(s.storyStage).toBe(1);
  });

  it('applies the chosen effects and clears the event', () => {
    const s = tick(game());
    const before = s.factions.terran.resources;
    const r = resolveEvent(s, 'conserve');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pendingEvent).toBeNull();
    expect(r.state.factions.terran.resources.credits).toBe(before.credits + 40);
    expect(r.state.events.at(-1)!.message).toContain('Conserve resources');
  });

  it('rejects unaffordable or unknown choices', () => {
    const s = tick(game());
    const poor: GameState = {
      ...s,
      factions: {
        ...s.factions,
        terran: { ...s.factions.terran, resources: { credits: 5, minerals: 0, research: 0 } },
      },
    };
    expect(checkEventChoice(poor, 'scan')).toEqual({
      ok: false,
      reason: 'Insufficient resources.',
    });
    expect(resolveEvent(poor, 'scan').ok).toBe(false);
    expect(checkEventChoice(s, 'bogus').ok).toBe(false);
    expect(resolveEvent(game(), 'scan').ok).toBe(false);
  });

  it('population effects respect capacity', () => {
    const g = game();
    const colony = Object.values(g.colonies).find((c) => c.ownerId === 'terran')!;
    const planet = g.galaxy.planets.find((p) => p.id === colony.planetId)!;
    const cap = colonyCapacity(planet);
    const s: GameState = {
      ...g,
      colonies: { ...g.colonies, [colony.id]: { ...colony, population: cap - 1 } },
      pendingEvent: { eventId: 'colonialCharter', tick: 0 },
    };
    const r = resolveEvent(s, 'subsidize'); // +2 population, −50 credits
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.colonies[colony.id]!.population).toBe(cap);
    expect(r.state.factions.terran.resources.credits).toBe(250);
  });

  it('story schedule references real events and is chronological', () => {
    for (const e of STORY_SCHEDULE) expect(EVENTS_BY_ID[e.eventId]).toBeDefined();
    const ticks = STORY_SCHEDULE.map((e) => e.tick);
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
  });

  it('random events are deterministic per seed and fire at most once each', () => {
    const play = (): GameState => {
      let s = game();
      for (let i = 0; i < 400; i++) {
        s = tick(s);
        if (s.pendingEvent) {
          const choice = EVENTS_BY_ID[s.pendingEvent.eventId]!.choices.find(
            (c) => checkEventChoice(s, c.id).ok,
          )!;
          s = (resolveEvent(s, choice.id) as { state: GameState }).state;
        }
      }
      return s;
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(new Set(a.seenEvents).size).toBe(a.seenEvents.length);
    expect(a.seenEvents.length).toBeGreaterThan(0);
    expect(a.storyStage).toBe(STORY_SCHEDULE.length);
  });

  it('maybeTriggerEvent is a no-op after victory', () => {
    const s: GameState = { ...game(), victory: { winner: 'terran', kind: 'score', tick: 0 } };
    expect(maybeTriggerEvent(s)).toBe(s);
  });
});

describe('victory', () => {
  it('no one wins at the start; progress is reported', () => {
    const g = game();
    expect(checkVictory(g)).toBeNull();
    const p = victoryProgress(g, 'terran');
    expect(p.dominion).toEqual({ owned: 1, needed: DOMINION_SYSTEMS });
    expect(p.ascendancy.techsDone).toBe(0);
    expect(p.daysLeft).toBe(TIME_LIMIT);
  });

  it('Ascendancy: the capstone starts a public 100-day attunement, then wins', () => {
    let s = { ...withResearch(game(), 'helion', 9000), storyStage: 6 };
    for (const id of [
      'deepCore',
      'fusionGrid',
      'orbitalMarkets',
      'quantumLabs',
      'expeditionDrives',
      'nexusCartography',
      'nexusAttunement',
    ]) {
      s = research(s, 'helion', id);
    }
    expect(victoryProgress(s, 'helion').ascendancy.done).toBe(true);
    expect(victoryProgress(s, 'helion').ascendancy.completesAt).toBe(ATTUNEMENT_DAYS);
    expect(s.events.at(-1)).toMatchObject({ kind: 'victory', factionId: 'helion' });
    expect(checkVictory(s)).toBeNull(); // not yet: attunement takes time

    const almost = { ...s, tick: ATTUNEMENT_DAYS - 1 };
    expect(checkVictory(almost)).toBeNull();
    const finished = { ...s, tick: ATTUNEMENT_DAYS };
    expect(checkVictory(finished)).toEqual({
      winner: 'helion',
      kind: 'ascendancy',
      tick: ATTUNEMENT_DAYS,
    });
    expect(tick({ ...s, tick: ATTUNEMENT_DAYS - 1 }).victory?.winner).toBe('helion');
  });

  it('the earlier attunement wins when two factions finish together', () => {
    const g = game();
    const s: GameState = {
      ...g,
      tick: 200,
      factions: {
        ...g.factions,
        terran: { ...g.factions.terran, attunementDone: 150 },
        oracle: { ...g.factions.oracle, attunementDone: 120 },
      },
    };
    expect(checkVictory(s)?.winner).toBe('oracle');
  });

  it('Dominion: controlling enough systems wins', () => {
    const g = game();
    const ids = Object.keys(g.systemStates).slice(0, DOMINION_SYSTEMS);
    const s: GameState = {
      ...g,
      systemStates: Object.fromEntries(
        Object.entries(g.systemStates).map(([id, st]) => [
          id,
          ids.includes(id)
            ? { ...st, ownerId: 'oracle' as const }
            : { ...st, ownerId: st.ownerId === 'oracle' ? null : st.ownerId },
        ]),
      ),
    };
    expect(checkVictory(s)).toMatchObject({ winner: 'oracle', kind: 'dominion' });
  });

  it('Hegemony: highest score wins at the time limit', () => {
    const g = { ...game(), tick: TIME_LIMIT };
    const v = checkVictory(g);
    expect(v?.kind).toBe('score');
    expect(score(g, v!.winner)).toBeGreaterThanOrEqual(score(g, 'terran'));
  });

  it('the simulation stops once the match is decided', () => {
    const over: GameState = { ...game(), victory: { winner: 'terran', kind: 'score', tick: 0 } };
    expect(tick(over)).toBe(over);
  });
});
