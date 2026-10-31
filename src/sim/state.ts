import { FACTION_IDS } from '@/domain/factions';
import {
  SAVE_VERSION,
  type Colony,
  type FactionState,
  type GameEvent,
  type GameState,
} from '@/domain/game';
import type { FactionId, Planet } from '@/domain/types';
import { colonyCapacity } from './economy';
import { createInitialSystemStates, generateGalaxy } from './galaxyGen';

export const STARTING_RESOURCES = { credits: 300, minerals: 150, research: 0 };
export const CAPITAL_POPULATION = 6;
const MAX_EVENTS = 200;

export function colonyIdFor(planetId: string): string {
  return `col-${planetId}`;
}

export function createGame(seed: number, playerFaction: FactionId): GameState {
  const galaxy = generateGalaxy(seed);
  const factions = {} as Record<FactionId, FactionState>;
  for (const id of FACTION_IDS) {
    factions[id] = {
      id,
      resources: { ...STARTING_RESOURCES },
      deficit: false,
      techs: [],
      attunementDone: null,
    };
  }
  const colonies: Record<string, Colony> = {};
  for (const system of galaxy.systems) {
    if (!system.homeOf) continue;
    const planetId = system.planetIds[0] as string;
    const planet = galaxy.planets.find((p) => p.id === planetId) as Planet;
    const id = colonyIdFor(planetId);
    colonies[id] = {
      id,
      planetId,
      systemId: system.id,
      ownerId: system.homeOf,
      population: Math.min(CAPITAL_POPULATION, colonyCapacity(planet)),
      buildings: [],
      queue: [],
    };
  }
  return {
    version: SAVE_VERSION,
    seed,
    tick: 0,
    playerFaction,
    galaxy,
    systemStates: createInitialSystemStates(galaxy),
    factions,
    colonies,
    fleets: {},
    nextFleetId: 1,
    events: [],
    nextEventId: 1,
    rngState: seed,
    pendingEvent: null,
    seenEvents: [],
    storyStage: 0,
    victory: null,
    bots: {},
    history: [],
  };
}

/** Returns a new state with an event appended (capped). */
export function withEvent(
  state: GameState,
  kind: GameEvent['kind'],
  factionId: FactionId,
  message: string,
): GameState {
  const event: GameEvent = {
    id: `evt-${state.nextEventId}`,
    tick: state.tick,
    kind,
    factionId,
    message,
  };
  return {
    ...state,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, event].slice(-MAX_EVENTS),
  };
}
