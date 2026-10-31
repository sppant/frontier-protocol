import { DEFAULT_PERSONALITY, DIFFICULTIES } from '@/bots/personalities';
import { runBots } from '@/bots/decide';
import type { BotMap, Difficulty, Personality } from '@/domain/bots';
import { FACTION_IDS } from '@/domain/factions';
import type { GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { createGame } from '@/sim/state';
import { tick } from '@/sim/tick';

/** One full game step: world rules, then each bot's decision round. */
export function step(state: GameState): GameState {
  const next = tick(state);
  return next.victory ? next : runBots(next);
}

/**
 * Advance up to `ticks` steps. Stops early the moment a player decision becomes pending
 * or the match ends, so batched catch-up never runs time past a decision.
 */
export function advanceGame(state: GameState, ticks: number): GameState {
  let s = state;
  for (let i = 0; i < ticks; i++) {
    s = step(s);
    if (s.pendingEvent || s.victory) break;
  }
  return s;
}

/** Attach bots to the given factions (default: every faction except the player). */
export function withBots(
  state: GameState,
  difficulty: Difficulty,
  factions: FactionId[] = FACTION_IDS.filter((f) => f !== state.playerFaction),
  personalities: Partial<Record<FactionId, Personality>> = {},
): GameState {
  const bots: BotMap = {};
  const interval = DIFFICULTIES[difficulty].interval;
  factions.forEach((f) => {
    bots[f] = {
      personality: personalities[f] ?? DEFAULT_PERSONALITY[f],
      difficulty,
      // Per-bot stream derived from the match seed; independent of the event RNG.
      rngState: (state.seed * 31 + FACTION_IDS.indexOf(f) * 7919 + 1) >>> 0,
      // Staggered so bots don't all act on the same tick.
      nextDecisionTick: interval + FACTION_IDS.indexOf(f),
      objective: null,
      log: [],
    };
  });
  return { ...state, bots };
}

/** Start a match: the player's faction plus bot opponents for the other three. */
export function newGame(
  seed: number,
  playerFaction: FactionId,
  difficulty: Difficulty = 'normal',
): GameState {
  return withBots(createGame(seed, playerFaction), difficulty);
}
