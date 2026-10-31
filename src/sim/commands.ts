import { BUILDINGS } from '@/domain/buildings';
import { FACTIONS } from '@/domain/factions';
import type { BuildingId, GameState, Resources } from '@/domain/game';
import { explorationOf, type FactionId } from '@/domain/types';
import { MIN_COLONY_HABITABILITY, planetOf } from './economy';
import { colonyIdFor, withEvent } from './state';

export const BASE_COLONY_COST: Resources = { credits: 120, minerals: 60, research: 0 };
export const MAX_QUEUE = 3;

export type Check<T = object> = ({ ok: true } & T) | { ok: false; reason: string };
export type CommandResult = { ok: true; state: GameState } | { ok: false; reason: string };

export function colonyCost(factionId: FactionId): Resources {
  const m = FACTIONS[factionId].modifiers.colonyCost;
  return {
    credits: Math.round(BASE_COLONY_COST.credits * m),
    minerals: Math.round(BASE_COLONY_COST.minerals * m),
    research: 0,
  };
}

function canAfford(have: Resources, cost: Resources): boolean {
  return (
    have.credits >= cost.credits && have.minerals >= cost.minerals && have.research >= cost.research
  );
}

function pay(state: GameState, factionId: FactionId, cost: Resources): GameState {
  const f = state.factions[factionId];
  return {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: {
        ...f,
        resources: {
          credits: f.resources.credits - cost.credits,
          minerals: f.resources.minerals - cost.minerals,
          research: f.resources.research - cost.research,
        },
      },
    },
  };
}

/** Why (or whether) a faction may colonize a planet right now. */
export function checkColonize(
  state: GameState,
  factionId: FactionId,
  planetId: string,
): Check<{ cost: Resources }> {
  const planet = planetOf(state, planetId);
  if (!planet) return { ok: false, reason: 'Unknown planet.' };
  if (state.colonies[colonyIdFor(planetId)])
    return { ok: false, reason: 'Planet is already colonized.' };
  if (planet.habitability < MIN_COLONY_HABITABILITY) {
    return { ok: false, reason: `Habitability too low (needs ${MIN_COLONY_HABITABILITY}).` };
  }
  const sys = state.systemStates[planet.systemId];
  if (!sys || explorationOf(sys, factionId) !== 'explored')
    return { ok: false, reason: 'System must be explored first.' };
  if (sys.ownerId && sys.ownerId !== factionId)
    return { ok: false, reason: 'System is controlled by another faction.' };
  if (sys.ownerId !== factionId) {
    const adjacent = state.galaxy.lanes.some(([a, b]) => {
      const other = a === planet.systemId ? b : b === planet.systemId ? a : null;
      return other !== null && state.systemStates[other]?.ownerId === factionId;
    });
    if (!adjacent) return { ok: false, reason: 'Must be in or adjacent to your territory.' };
  }
  const cost = colonyCost(factionId);
  if (!canAfford(state.factions[factionId].resources, cost))
    return { ok: false, reason: 'Insufficient resources.' };
  return { ok: true, cost };
}

export function colonize(state: GameState, factionId: FactionId, planetId: string): CommandResult {
  const check = checkColonize(state, factionId, planetId);
  if (!check.ok) return check;
  const planet = planetOf(state, planetId);
  if (!planet) return { ok: false, reason: 'Unknown planet.' };
  const sys = state.systemStates[planet.systemId];
  if (!sys) return { ok: false, reason: 'Unknown system.' };
  const id = colonyIdFor(planetId);
  let next = pay(state, factionId, check.cost);
  next = {
    ...next,
    colonies: {
      ...next.colonies,
      [id]: {
        id,
        planetId,
        systemId: planet.systemId,
        ownerId: factionId,
        population: 1,
        buildings: [],
        queue: [],
      },
    },
    systemStates: {
      ...next.systemStates,
      [planet.systemId]: {
        exploration: { ...sys.exploration, [factionId]: 'explored' },
        ownerId: factionId,
      },
    },
  };
  return {
    ok: true,
    state: withEvent(
      next,
      'colony',
      factionId,
      `${FACTIONS[factionId].name} colonized ${planet.name}.`,
    ),
  };
}

export function checkBuild(
  state: GameState,
  factionId: FactionId,
  colonyId: string,
  building: BuildingId,
): Check<{ cost: Resources }> {
  const colony = state.colonies[colonyId];
  if (!colony || colony.ownerId !== factionId) return { ok: false, reason: 'Not your colony.' };
  if (colony.buildings.includes(building) || colony.queue.some((q) => q.building === building)) {
    return { ok: false, reason: 'Already built or queued.' };
  }
  if (colony.queue.length >= MAX_QUEUE) return { ok: false, reason: 'Construction queue is full.' };
  const cost = BUILDINGS[building].cost;
  if (!canAfford(state.factions[factionId].resources, cost))
    return { ok: false, reason: 'Insufficient resources.' };
  return { ok: true, cost };
}

export function startConstruction(
  state: GameState,
  factionId: FactionId,
  colonyId: string,
  building: BuildingId,
): CommandResult {
  const check = checkBuild(state, factionId, colonyId, building);
  if (!check.ok) return check;
  const colony = state.colonies[colonyId];
  if (!colony) return { ok: false, reason: 'Not your colony.' };
  const paid = pay(state, factionId, check.cost);
  return {
    ok: true,
    state: {
      ...paid,
      colonies: {
        ...paid.colonies,
        [colonyId]: {
          ...colony,
          queue: [...colony.queue, { building, remaining: BUILDINGS[building].buildTicks }],
        },
      },
    },
  };
}
