import { BUILDINGS } from '@/domain/buildings';
import type { FactionModifiers } from '@/domain/factions';
import { LEVEL_OUTPUT_BONUS, LEVEL_UPKEEP_BONUS } from '@/domain/buildings';
import type { BuildingId, Colony, GameState, Resources } from '@/domain/game';
import type { FactionId, Planet } from '@/domain/types';
import { modifiersFor } from './modifiers';

const BASE_TAX_PER_POP = 0.5;
const COLONY_BASE_UPKEEP = 1;
const GROWTH_RATE = 0.05;

export function emptyResources(): Resources {
  return { credits: 0, minerals: 0, research: 0 };
}

/** Habitability including terraforming (capped at 100). */
export function effectiveHabitability(planet: Planet, terraform = 0): number {
  return Math.min(100, planet.habitability + terraform);
}

/** Maximum population a planet supports. */
export function colonyCapacity(planet: Planet, terraform = 0): number {
  return Math.max(
    1,
    Math.round((effectiveHabitability(planet, terraform) / 100) * planet.size * 10),
  );
}

/** Level of a built building (1 = as built). */
export function buildingLevel(colony: Colony, building: BuildingId): number {
  return 1 + (colony.upgrades[building] ?? 0);
}

export interface ColonyReport {
  colonyId: string;
  /** Gross production per tick, after faction modifiers. */
  production: Resources;
  /** Credit upkeep per tick, after faction modifiers. */
  upkeep: number;
}

/** Per-tick output of one colony. Pure and inspectable. */
export function colonyReport(colony: Colony, planet: Planet, mods: FactionModifiers): ColonyReport {
  const pop = Math.floor(colony.population);
  const raw = emptyResources();
  raw.credits += pop * BASE_TAX_PER_POP;
  for (const b of colony.buildings) {
    const boost = 1 + LEVEL_OUTPUT_BONUS * (buildingLevel(colony, b) - 1);
    if (b === 'mine') raw.minerals += (2 + planet.minerals) * boost;
    else if (b === 'lab') raw.research += (1 + pop * 0.12) * boost;
    else if (b === 'tradeHub') raw.credits += (2 + pop * 0.4) * boost;
  }
  const buildingUpkeep = colony.buildings.reduce(
    (sum, b) =>
      sum + BUILDINGS[b].upkeep * (1 + LEVEL_UPKEEP_BONUS * (buildingLevel(colony, b) - 1)),
    0,
  );
  return {
    colonyId: colony.id,
    production: {
      credits: raw.credits * mods.credits,
      minerals: raw.minerals * mods.minerals,
      research: raw.research * mods.research,
    },
    upkeep: (COLONY_BASE_UPKEEP + buildingUpkeep) * mods.upkeep,
  };
}

export interface FactionReport {
  colonies: ColonyReport[];
  /** Net change per tick (credits net of upkeep). */
  net: Resources;
  upkeep: number;
}

export function planetOf(state: GameState, planetId: string): Planet | undefined {
  return state.galaxy.planets.find((p) => p.id === planetId);
}

export function factionColonies(state: GameState, factionId: FactionId): Colony[] {
  return Object.values(state.colonies).filter((c) => c.ownerId === factionId);
}

export function factionReport(state: GameState, factionId: FactionId): FactionReport {
  const net = emptyResources();
  let upkeep = 0;
  const colonies: ColonyReport[] = [];
  const mods = modifiersFor(state, factionId);
  for (const colony of factionColonies(state, factionId)) {
    const planet = planetOf(state, colony.planetId);
    if (!planet) continue;
    const r = colonyReport(colony, planet, mods);
    colonies.push(r);
    net.credits += r.production.credits;
    net.minerals += r.production.minerals;
    net.research += r.production.research;
    upkeep += r.upkeep;
  }
  net.credits -= upkeep;
  return { colonies, net, upkeep };
}

/** Logistic population growth toward capacity. */
export function growPopulation(colony: Colony, planet: Planet, growthMod: number): number {
  const cap = colonyCapacity(planet, colony.terraform);
  if (colony.population >= cap) return cap;
  const next =
    colony.population + GROWTH_RATE * growthMod * colony.population * (1 - colony.population / cap);
  return cap - next < 0.01 ? cap : next;
}
