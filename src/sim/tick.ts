import { BUILDINGS } from '@/domain/buildings';
import { FACTION_IDS, FACTIONS } from '@/domain/factions';
import type { Colony, FactionState, GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { advanceFleets } from './fleets';
import { factionReport, growPopulation, planetOf } from './economy';
import { withEvent } from './state';

function advanceFaction(state: GameState, id: FactionId): FactionState {
  const faction = state.factions[id];
  const { net } = factionReport(state, id);
  const credits = faction.resources.credits + net.credits;
  return {
    ...faction,
    deficit: credits < 0,
    resources: {
      credits: Math.max(0, credits),
      minerals: faction.resources.minerals + net.minerals,
      research: faction.resources.research + net.research,
    },
  };
}

/**
 * Advance the simulation by exactly one tick (one game day).
 * Order: income/upkeep from start-of-tick state → construction → population growth → tick++ → fleet movement.
 */
export function tick(state: GameState): GameState {
  const factions = { ...state.factions };
  for (const id of FACTION_IDS) factions[id] = advanceFaction(state, id);

  const colonies: Record<string, Colony> = {};
  const completed: { colony: Colony; building: keyof typeof BUILDINGS }[] = [];
  for (const colony of Object.values(state.colonies)) {
    const planet = planetOf(state, colony.planetId);
    let next = colony;
    if (colony.queue.length > 0) {
      const [head, ...rest] = colony.queue;
      const remaining = (head?.remaining ?? 0) - 1;
      if (head && remaining <= 0) {
        next = { ...next, buildings: [...next.buildings, head.building], queue: rest };
        completed.push({ colony: next, building: head.building });
      } else if (head) {
        next = { ...next, queue: [{ ...head, remaining }, ...rest] };
      }
    }
    if (planet) {
      const population = growPopulation(next, planet, FACTIONS[next.ownerId].modifiers.growth);
      if (population !== next.population) next = { ...next, population };
    }
    colonies[colony.id] = next;
  }

  let next: GameState = advanceFleets({ ...state, factions, colonies, tick: state.tick + 1 });
  for (const { colony, building } of completed) {
    const planet = planetOf(next, colony.planetId);
    next = withEvent(
      next,
      'construction',
      colony.ownerId,
      `${BUILDINGS[building].name} completed on ${planet?.name ?? colony.planetId}.`,
    );
  }
  for (const id of FACTION_IDS) {
    if (factions[id].deficit && !state.factions[id].deficit) {
      next = withEvent(next, 'economy', id, 'Credit deficit: upkeep exceeds available credits.');
    }
  }
  return next;
}

export function advance(state: GameState, ticks: number): GameState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = tick(s);
  return s;
}
