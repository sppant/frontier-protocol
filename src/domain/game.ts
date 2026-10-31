import type { FactionId, Galaxy, SystemState } from './types';

export type ResourceId = 'credits' | 'minerals' | 'research';
export type Resources = Record<ResourceId, number>;
export const RESOURCE_IDS: ResourceId[] = ['credits', 'minerals', 'research'];

export type BuildingId = 'mine' | 'lab' | 'tradeHub';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  cost: Resources;
  /** Construction time in ticks (days). */
  buildTicks: number;
  /** Credits per tick. */
  upkeep: number;
}

export interface ConstructionItem {
  building: BuildingId;
  remaining: number;
}

export interface Colony {
  id: string;
  planetId: string;
  systemId: string;
  ownerId: FactionId;
  /** Fractional; displayed floored. */
  population: number;
  buildings: BuildingId[];
  queue: ConstructionItem[];
}

export interface FactionState {
  id: FactionId;
  resources: Resources;
  /** True if upkeep could not be paid last tick. */
  deficit: boolean;
}

/** A scout fleet travelling hop by hop along hyperlanes to survey `targetId`. */
export interface Fleet {
  id: string;
  ownerId: FactionId;
  kind: 'scout';
  /** Current leg: fromId → toId. */
  fromId: string;
  toId: string;
  /** Systems still to visit after `toId`. */
  remainingPath: string[];
  /** Ticks elapsed on the current leg. */
  progress: number;
  legTicks: number;
  targetId: string;
}

export type GameEventKind = 'colony' | 'construction' | 'economy' | 'exploration' | 'discovery';

export interface GameEvent {
  id: string;
  tick: number;
  kind: GameEventKind;
  factionId: FactionId;
  message: string;
}

export const SAVE_VERSION = 1;

/** The complete, serializable game state. All sim functions are pure over this. */
export interface GameState {
  version: typeof SAVE_VERSION;
  seed: number;
  /** 1 tick = 1 game day. */
  tick: number;
  playerFaction: FactionId;
  galaxy: Galaxy;
  systemStates: Record<string, SystemState>;
  factions: Record<FactionId, FactionState>;
  colonies: Record<string, Colony>;
  fleets: Record<string, Fleet>;
  nextFleetId: number;
  events: GameEvent[];
  nextEventId: number;
}
