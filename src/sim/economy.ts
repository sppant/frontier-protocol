import { BUILDINGS } from '@/domain/buildings';
import type { FactionModifiers } from '@/domain/factions';
import type { Colony, GameState, Resources } from '@/domain/game';
import type { FactionId, Planet } from '@/domain/types';
import { modifiersFor } from './modifiers';

export const MIN_COLONY_HABITABILITY = 20;
const BASE_TAX_PER_POP = 0.5;
const COLONY_BASE_UPKEEP = 1;
const GROWTH_RATE = 0.05;

export function emptyResources(): Resources {
  return { credits: 0, minerals: 0, research: 0 };
}

/** Maximum population a planet supports. */
export function colonyCapacity(planet: Planet): number {
  return Math.max(1, Math.round((planet.habitability / 100) * planet.size * 10));
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
    if (b === 'mine') raw.minerals += 2 + planet.minerals;
    else if (b === 'lab') raw.research += 1 + pop * 0.12;
    else if (b === 'tradeHub') raw.credits += 2 + pop * 0.4;
  }
  const buildingUpkeep = colony.buildings.reduce((sum, b) => sum + BUILDINGS[b].upkeep, 0);
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
  const cap = colonyCapacity(planet);
  if (colony.population >= cap) return cap;
  const next =
    colony.population + GROWTH_RATE * growthMod * colony.population * (1 - colony.population / cap);
  return cap - next < 0.01 ? cap : next;
}
