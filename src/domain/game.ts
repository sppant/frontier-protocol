import type { BotMap } from './bots';
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

/** One job in a colony's construction queue. */
export type ConstructionItem =
  | { kind: 'build'; building: BuildingId; remaining: number }
  | { kind: 'upgrade'; building: BuildingId; remaining: number }
  | { kind: 'terraform'; remaining: number };

export interface Colony {
  id: string;
  planetId: string;
  systemId: string;
  ownerId: FactionId;
  /** Fractional; displayed floored. */
  population: number;
  buildings: BuildingId[];
  /** Extra levels per built building (level = 1 + upgrades). */
  upgrades: Partial<Record<BuildingId, number>>;
  /** Habitability added by terraforming (0..MAX_TERRAFORM). */
  terraform: number;
  queue: ConstructionItem[];
}

export interface FactionState {
  id: FactionId;
  resources: Resources;
  /** True if upkeep could not be paid last tick. */
  deficit: boolean;
  techs: TechId[];
  /** Day on which this faction's Nexus Attunement completes (Ascendancy victory); null if not started. */
  attunementDone: number | null;
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
  /** Speed multiplier locked in at launch. */
  speed: number;
  targetId: string;
}

export type GameEventKind =
  | 'colony'
  | 'construction'
  | 'economy'
  | 'exploration'
  | 'discovery'
  | 'research'
  | 'story'
  | 'victory';

export type TechId = string;

export type VictoryKind = 'ascendancy' | 'dominion' | 'score';

export interface Victory {
  winner: FactionId;
  kind: VictoryKind;
  tick: number;
}

/** A narrative/random event awaiting the player's choice. */
export interface PendingEvent {
  eventId: string;
  tick: number;
}

export interface GameEvent {
  id: string;
  tick: number;
  kind: GameEventKind;
  factionId: FactionId;
  message: string;
}

/** Bump when the shape of GameState changes, and add a migration in persistence/save.ts. */
export const SAVE_VERSION = 3;

/** Score snapshot used for the standings chart. */
export interface HistoryPoint {
  tick: number;
  scores: Record<FactionId, number>;
}

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
  /** Resumable PRNG state for gameplay randomness (events). */
  rngState: number;
  /** Player-facing event awaiting a decision; null if none. */
  pendingEvent: PendingEvent | null;
  /** Ids of random events already shown (each fires once). */
  seenEvents: string[];
  /** Index of the next story chapter event to fire. */
  storyStage: number;
  victory: Victory | null;
  /** Bot-controlled factions. Empty in bare sim states. */
  bots: BotMap;
  /** Score snapshots every HISTORY_INTERVAL ticks (capped). */
  history: HistoryPoint[];
}
