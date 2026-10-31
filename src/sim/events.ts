import { EVENTS_BY_ID, RANDOM_EVENTS, STORY_SCHEDULE, type EventChoice } from '@/domain/events';
import type { GameState } from '@/domain/game';
import { colonyCapacity, planetOf } from './economy';
import type { Check, CommandResult } from './commands';
import { createRng } from './rng';
import { withEvent } from './state';

/** Ticks between rolls for a random event. */
export const EVENT_INTERVAL = 12;
export const EVENT_CHANCE = 0.4;

/**
 * If no decision is pending, surface the next due story event, or (on the interval)
 * roll for a random one. Deterministic: consumes the seeded RNG stored in state.
 * Events are player-facing flavour: they only affect the player's faction.
 */
export function maybeTriggerEvent(state: GameState): GameState {
  if (state.pendingEvent || state.victory) return state;

  const story = STORY_SCHEDULE[state.storyStage];
  if (story && state.tick >= story.tick) {
    return show({ ...state, storyStage: state.storyStage + 1 }, story.eventId);
  }
  if (state.tick === 0 || state.tick % EVENT_INTERVAL !== 0) return state;

  const rng = createRng(state.rngState);
  const roll = rng.chance(EVENT_CHANCE);
  const pool = RANDOM_EVENTS.filter((e) => !state.seenEvents.includes(e.id));
  const picked = roll && pool.length > 0 ? rng.pick(pool) : null;
  const next: GameState = { ...state, rngState: rng.state() };
  return picked ? show({ ...next, seenEvents: [...next.seenEvents, picked.id] }, picked.id) : next;
}

function show(state: GameState, eventId: string): GameState {
  const def = EVENTS_BY_ID[eventId];
  if (!def) return state;
  const next: GameState = { ...state, pendingEvent: { eventId, tick: state.tick } };
  return withEvent(next, 'story', state.playerFaction, `Event: ${def.title}`);
}

export function checkEventChoice(
  state: GameState,
  choiceId: string,
): Check<{ choice: EventChoice }> {
  if (!state.pendingEvent) return { ok: false, reason: 'No event is pending.' };
  const choice = EVENTS_BY_ID[state.pendingEvent.eventId]?.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, reason: 'Unknown choice.' };
  const have = state.factions[state.playerFaction].resources;
  const e = choice.effects;
  if (
    have.credits + (e.credits ?? 0) < 0 ||
    have.minerals + (e.minerals ?? 0) < 0 ||
    have.research + (e.research ?? 0) < 0
  ) {
    return { ok: false, reason: 'Insufficient resources.' };
  }
  return { ok: true, choice };
}

export function resolveEvent(state: GameState, choiceId: string): CommandResult {
  const check = checkEventChoice(state, choiceId);
  if (!check.ok) return check;
  const { effects } = check.choice;
  const player = state.playerFaction;
  const f = state.factions[player];

  const colonies = { ...state.colonies };
  if (effects.population) {
    for (const c of Object.values(colonies)) {
      if (c.ownerId !== player) continue;
      const planet = planetOf(state, c.planetId);
      const cap = planet ? colonyCapacity(planet, c.terraform) : c.population;
      colonies[c.id] = { ...c, population: Math.min(cap, c.population + effects.population) };
    }
  }
  const next: GameState = {
    ...state,
    pendingEvent: null,
    colonies,
    factions: {
      ...state.factions,
      [player]: {
        ...f,
        resources: {
          credits: f.resources.credits + (effects.credits ?? 0),
          minerals: f.resources.minerals + (effects.minerals ?? 0),
          research: f.resources.research + (effects.research ?? 0),
        },
      },
    },
  };
  return {
    ok: true,
    state: withEvent(next, 'story', player, `Decision: ${check.choice.label}.`),
  };
}
