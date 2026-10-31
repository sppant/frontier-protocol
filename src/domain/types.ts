export type FactionId = 'terran' | 'helion' | 'veydran' | 'oracle';
export type Vec3 = readonly [number, number, number];

export type StarClass = 'red' | 'orange' | 'yellow' | 'white' | 'blue';
export type PlanetType = 'barren' | 'terran' | 'ocean' | 'desert' | 'ice' | 'gas' | 'volcanic';
export type ExplorationStatus = 'unknown' | 'detected' | 'explored';

/** Static, generated-once description of a star system. */
export interface StarSystem {
  id: string;
  name: string;
  position: Vec3;
  starClass: StarClass;
  planetIds: string[];
  /** Ancient Nexus structure present (revealed on exploration). */
  hasAnomaly: boolean;
  homeOf: FactionId | null;
}

export interface Planet {
  id: string;
  systemId: string;
  name: string;
  type: PlanetType;
  /** 1 (small) – 3 (large). */
  size: 1 | 2 | 3;
  /** Habitability 0–100; gas giants and barren worlds are low. */
  habitability: number;
  /** Mineral richness 1–5. */
  minerals: number;
}

/** Immutable galaxy layout. Mutable ownership/exploration lives in SystemState. */
export interface Galaxy {
  seed: number;
  systems: StarSystem[];
  planets: Planet[];
  /** Hyperlanes as pairs of system ids. */
  lanes: [string, string][];
}

/** Per-system dynamic state. */
export interface SystemState {
  /** What each faction knows about this system (fog of war is per faction). */
  exploration: Record<FactionId, ExplorationStatus>;
  ownerId: FactionId | null;
}

/** Exploration status of a system from one faction's point of view. */
export function explorationOf(
  state: SystemState | undefined,
  faction: FactionId,
): ExplorationStatus {
  return state?.exploration[faction] ?? 'unknown';
}
