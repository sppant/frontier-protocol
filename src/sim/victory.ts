import { FACTION_IDS } from '@/domain/factions';
import type { GameState, Victory } from '@/domain/game';
import { TECHS } from '@/domain/techs';
import type { FactionId } from '@/domain/types';
import { factionColonies } from './economy';

/** Systems needed to win by Dominion (out of 16). */
export const DOMINION_SYSTEMS = 8;
/** Days a faction needs to complete Nexus Attunement once it has researched it. */
export const ATTUNEMENT_DAYS = 100;
/** Day on which the match is decided by score if nobody has won. */
export const TIME_LIMIT = 720;

export function systemsOwned(state: GameState, factionId: FactionId): number {
  return Object.values(state.systemStates).filter((s) => s.ownerId === factionId).length;
}

/** Standing used for the Hegemony (time limit) outcome and the scoreboard. */
export function score(state: GameState, factionId: FactionId): number {
  const pop = factionColonies(state, factionId).reduce(
    (sum, c) => sum + Math.floor(c.population),
    0,
  );
  const techs = state.factions[factionId].techs.length;
  return systemsOwned(state, factionId) * 10 + pop + techs * 5;
}

export interface VictoryProgress {
  /** `completesAt` is the day this faction's attunement finishes, if begun. */
  ascendancy: { done: boolean; techsDone: number; techsNeeded: number; completesAt: number | null };
  dominion: { owned: number; needed: number };
  daysLeft: number;
}

export function victoryProgress(state: GameState, factionId: FactionId): VictoryProgress {
  const capstone = TECHS.find((t) => t.capstone);
  const chain = new Set<string>();
  const visit = (id: string) => {
    if (chain.has(id)) return;
    chain.add(id);
    TECHS.find((t) => t.id === id)?.requires.forEach(visit);
  };
  if (capstone) visit(capstone.id);
  const owned = state.factions[factionId].techs;
  return {
    ascendancy: {
      done: !!capstone && owned.includes(capstone.id),
      completesAt: state.factions[factionId].attunementDone,
      techsDone: [...chain].filter((id) => owned.includes(id)).length,
      techsNeeded: chain.size,
    },
    dominion: { owned: systemsOwned(state, factionId), needed: DOMINION_SYSTEMS },
    daysLeft: Math.max(0, TIME_LIMIT - state.tick),
  };
}

/** Evaluate victory for all factions. Ties resolve in canonical faction order. */
export function checkVictory(state: GameState): Victory | null {
  if (state.victory) return state.victory;
  const attuned = FACTION_IDS.filter((f) => {
    const done = state.factions[f].attunementDone;
    return done !== null && done <= state.tick;
  }).sort(
    (a, b) => (state.factions[a].attunementDone ?? 0) - (state.factions[b].attunementDone ?? 0),
  );
  if (attuned[0]) return { winner: attuned[0], kind: 'ascendancy', tick: state.tick };
  for (const f of FACTION_IDS) {
    if (systemsOwned(state, f) >= DOMINION_SYSTEMS) {
      return { winner: f, kind: 'dominion', tick: state.tick };
    }
  }
  if (state.tick >= TIME_LIMIT) {
    const best = [...FACTION_IDS].sort((a, b) => score(state, b) - score(state, a))[0] as FactionId;
    return { winner: best, kind: 'score', tick: state.tick };
  }
  return null;
}

/** Days between standings snapshots, and how many are kept. */
export const HISTORY_INTERVAL = 10;
const MAX_HISTORY = 100;

/** Append a score snapshot when the tick is a multiple of the interval. */
export function recordHistory(state: GameState): GameState {
  if (state.tick % HISTORY_INTERVAL !== 0) return state;
  const scores = Object.fromEntries(FACTION_IDS.map((f) => [f, score(state, f)])) as Record<
    FactionId,
    number
  >;
  return {
    ...state,
    history: [...state.history, { tick: state.tick, scores }].slice(-MAX_HISTORY),
  };
}
