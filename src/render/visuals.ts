import type { ExplorationStatus, PlanetType, StarClass } from '@/domain/types';

export const STAR_COLORS: Record<StarClass, string> = {
  red: '#ff7a5c',
  orange: '#ffb066',
  yellow: '#ffe8a3',
  white: '#f2f6ff',
  blue: '#8fb8ff',
};

export const STAR_SIZES: Record<StarClass, number> = {
  red: 0.8,
  orange: 0.9,
  yellow: 1,
  white: 1.1,
  blue: 1.3,
};

export const UNKNOWN_COLOR = '#4a5666';

export const PLANET_COLORS: Record<PlanetType, string> = {
  barren: '#9a8f86',
  terran: '#4fa86a',
  ocean: '#3d82d6',
  desert: '#d6a85a',
  ice: '#bfe3f2',
  gas: '#d98f5c',
  volcanic: '#d6523a',
};

export const EXPLORATION_LABEL: Record<ExplorationStatus, string> = {
  unknown: 'Unknown',
  detected: 'Detected',
  explored: 'Explored',
};

/** Visual size multiplier by exploration status: unknown systems read as faint dots. */
export function statusScale(status: ExplorationStatus): number {
  return status === 'unknown' ? 0.55 : status === 'detected' ? 0.8 : 1;
}

/** Display name: unexplored systems stay anonymous. */
export function displayName(name: string, status: ExplorationStatus): string {
  return status === 'unknown' ? 'Unknown system' : name;
}
