import {
  BUILDINGS,
  MAX_BUILDING_LEVEL,
  MAX_TERRAFORM,
  TERRAFORM_COST,
  TERRAFORM_TICKS,
  UPGRADE_COST_FACTOR,
} from '@/domain/buildings';
import { FACTIONS } from '@/domain/factions';
import { BASE_MIN_HABITABILITY, canTerraform, minHabitabilityFor, modifiersFor } from './modifiers';
import type { BuildingId, GameState, Resources } from '@/domain/game';
import { explorationOf, type FactionId, type Planet } from '@/domain/types';
import { buildingLevel, effectiveHabitability, planetOf } from './economy';
import { colonyIdFor, withEvent } from './state';

export const BASE_COLONY_COST: Resources = { credits: 120, minerals: 60, research: 0 };
export const MAX_QUEUE = 3;

export type Check<T = object> = ({ ok: true } & T) | { ok: false; reason: string };
export type CommandResult = { ok: true; state: GameState } | { ok: false; reason: string };

/** Outposts on planets below the normal habitability threshold cost this much more. */
export const OUTPOST_COST_FACTOR = 1.5;

export function colonyCost(state: GameState, factionId: FactionId, planet?: Planet): Resources {
  const outpost = planet && planet.habitability < BASE_MIN_HABITABILITY ? OUTPOST_COST_FACTOR : 1;
  const m = modifiersFor(state, factionId).colonyCost * outpost;
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
  const minHab = minHabitabilityFor(state, factionId);
  if (planet.habitability < minHab) {
    return {
      ok: false,
      reason:
        minHab > 5
          ? `Habitability too low (needs ${minHab}; research Hostile-Environment Habitats for 5).`
          : `Habitability too low (needs ${minHab}).`,
    };
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
  const cost = colonyCost(state, factionId, planet);
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
        upgrades: {},
        terraform: 0,
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
  if (
    colony.buildings.includes(building) ||
    colony.queue.some((q) => q.kind === 'build' && q.building === building)
  ) {
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
          queue: [
            ...colony.queue,
            { kind: 'build', building, remaining: BUILDINGS[building].buildTicks },
          ],
        },
      },
    },
  };
}

/** Cost to raise a building from its current level to the next. */
export function upgradeCost(building: BuildingId, currentLevel: number): Resources {
  const base = BUILDINGS[building].cost;
  const f = UPGRADE_COST_FACTOR * currentLevel;
  return {
    credits: Math.round(base.credits * f),
    minerals: Math.round(base.minerals * f),
    research: Math.round(base.research * f),
  };
}

export function upgradeTicks(building: BuildingId, currentLevel: number): number {
  return Math.round(BUILDINGS[building].buildTicks * (1 + 0.25 * currentLevel));
}

export function checkUpgrade(
  state: GameState,
  factionId: FactionId,
  colonyId: string,
  building: BuildingId,
): Check<{ cost: Resources; level: number }> {
  const colony = state.colonies[colonyId];
  if (!colony || colony.ownerId !== factionId) return { ok: false, reason: 'Not your colony.' };
  if (!colony.buildings.includes(building)) return { ok: false, reason: 'Not built yet.' };
  const level = buildingLevel(colony, building);
  if (level >= MAX_BUILDING_LEVEL) return { ok: false, reason: 'Already at maximum level.' };
  if (colony.queue.some((q) => q.kind !== 'terraform' && q.building === building)) {
    return { ok: false, reason: 'Already being worked on.' };
  }
  if (colony.queue.length >= MAX_QUEUE) return { ok: false, reason: 'Construction queue is full.' };
  const cost = upgradeCost(building, level);
  if (!canAfford(state.factions[factionId].resources, cost))
    return { ok: false, reason: 'Insufficient resources.' };
  return { ok: true, cost, level };
}

export function startUpgrade(
  state: GameState,
  factionId: FactionId,
  colonyId: string,
  building: BuildingId,
): CommandResult {
  const check = checkUpgrade(state, factionId, colonyId, building);
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
          queue: [
            ...colony.queue,
            { kind: 'upgrade', building, remaining: upgradeTicks(building, check.level) },
          ],
        },
      },
    },
  };
}

export function checkTerraform(
  state: GameState,
  factionId: FactionId,
  colonyId: string,
): Check<{ cost: Resources }> {
  const colony = state.colonies[colonyId];
  if (!colony || colony.ownerId !== factionId) return { ok: false, reason: 'Not your colony.' };
  if (!canTerraform(state, factionId)) return { ok: false, reason: 'Requires Terraforming.' };
  const planet = planetOf(state, colony.planetId);
  if (!planet) return { ok: false, reason: 'Unknown planet.' };
  if (colony.terraform >= MAX_TERRAFORM) return { ok: false, reason: 'Fully terraformed.' };
  if (effectiveHabitability(planet, colony.terraform) >= 100) {
    return { ok: false, reason: 'Already perfectly habitable.' };
  }
  if (colony.queue.some((q) => q.kind === 'terraform')) {
    return { ok: false, reason: 'Terraforming already under way.' };
  }
  if (colony.queue.length >= MAX_QUEUE) return { ok: false, reason: 'Construction queue is full.' };
  if (!canAfford(state.factions[factionId].resources, TERRAFORM_COST)) {
    return { ok: false, reason: 'Insufficient resources.' };
  }
  return { ok: true, cost: TERRAFORM_COST };
}

export function startTerraform(
  state: GameState,
  factionId: FactionId,
  colonyId: string,
): CommandResult {
  const check = checkTerraform(state, factionId, colonyId);
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
          queue: [...colony.queue, { kind: 'terraform', remaining: TERRAFORM_TICKS }],
        },
      },
    },
  };
}
