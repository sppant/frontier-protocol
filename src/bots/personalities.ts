import type { Difficulty, Personality } from '@/domain/bots';
import type { FactionId } from '@/domain/types';

/** How strongly a personality values each kind of consideration (1 = neutral). */
export interface Weights {
  explore: number;
  expand: number;
  economy: number;
  research: number;
  /** Claiming systems next to rivals. */
  contest: number;
  /** Preferring interior, rival-free systems. */
  safety: number;
  /** Extra appetite for minerals (industry). */
  minerals: number;
}

export interface PersonalityDef {
  name: string;
  description: string;
  weights: Weights;
}

export const PERSONALITIES: Record<Personality, PersonalityDef> = {
  pioneer: {
    name: 'Pioneer',
    description: 'Explores aggressively and claims new systems first.',
    weights: {
      explore: 1.5,
      expand: 1.3,
      economy: 0.8,
      research: 0.7,
      contest: 0.3,
      safety: 0,
      minerals: 1,
    },
  },
  merchant: {
    name: 'Merchant',
    description: 'Builds a strong economy before expanding.',
    weights: {
      explore: 0.7,
      expand: 0.9,
      economy: 1.5,
      research: 0.8,
      contest: 0.2,
      safety: 0.2,
      minerals: 1,
    },
  },
  warlord: {
    name: 'Warlord',
    description: 'Seizes contested frontier systems and industrial output to hold territory.',
    weights: {
      explore: 0.9,
      expand: 1.2,
      economy: 1,
      research: 0.5,
      contest: 1.5,
      safety: 0,
      minerals: 1.3,
    },
  },
  oracle: {
    name: 'Oracle',
    description: 'Pursues research and the Nexus, expanding defensively.',
    weights: {
      explore: 1,
      expand: 0.7,
      economy: 0.8,
      research: 1.6,
      contest: 0,
      safety: 1,
      minerals: 1,
    },
  },
};

/** Personality each faction's bot plays by default. */
export const DEFAULT_PERSONALITY: Record<FactionId, Personality> = {
  terran: 'merchant',
  helion: 'pioneer',
  veydran: 'warlord',
  oracle: 'oracle',
};

/**
 * Difficulty changes decision *quality*, never resources: faster decisions,
 * more actions per decision, less scoring noise, safer reserves and long-term planning.
 */
export interface DifficultyDef {
  /** Ticks between decisions. */
  interval: number;
  /** Max actions per decision. */
  actions: number;
  /** Random multiplicative score noise (± fraction). */
  noise: number;
  /** Credits kept in reserve after spending. */
  reserve: number;
  /** Pursues a strategic objective (capstone chain / dominion). */
  planning: boolean;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { interval: 10, actions: 1, noise: 0.35, reserve: 0, planning: false },
  normal: { interval: 6, actions: 2, noise: 0.12, reserve: 20, planning: true },
  hard: { interval: 4, actions: 3, noise: 0, reserve: 40, planning: true },
};

/** Candidates below this utility are not worth taking. */
export const MIN_UTILITY = 0.2;
