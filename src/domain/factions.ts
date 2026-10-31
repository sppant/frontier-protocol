import type { FactionId } from './types';

/** Multipliers applied to a faction's economy. 1 = baseline. */
export interface FactionModifiers {
  credits: number;
  minerals: number;
  research: number;
  /** Colonization cost multiplier (lower is cheaper). */
  colonyCost: number;
  /** Population growth multiplier. */
  growth: number;
  /** Upkeep multiplier (lower is cheaper). */
  upkeep: number;
}

export interface FactionInfo {
  id: FactionId;
  name: string;
  /** Hex color; keep in sync with --faction-* tokens in styles/tokens.css. */
  color: string;
  tagline: string;
  modifiers: FactionModifiers;
}

export const FACTIONS: Record<FactionId, FactionInfo> = {
  terran: {
    id: 'terran',
    name: 'Terran Directorate',
    color: '#4aa3ff',
    tagline: 'Balanced economy, strong colonization.',
    modifiers: { credits: 1.05, minerals: 1, research: 1, colonyCost: 0.8, growth: 1.2, upkeep: 1 },
  },
  helion: {
    id: 'helion',
    name: 'Helion Collective',
    color: '#4fe0a0',
    tagline: 'Research and exploration specialists.',
    modifiers: { credits: 1, minerals: 1, research: 1.3, colonyCost: 1, growth: 1, upkeep: 1 },
  },
  veydran: {
    id: 'veydran',
    name: 'Veydran Dominion',
    color: '#ff5a4f',
    tagline: 'Military-oriented, aggressive expansion.',
    modifiers: { credits: 0.95, minerals: 1.2, research: 0.9, colonyCost: 1, growth: 1, upkeep: 1 },
  },
  oracle: {
    id: 'oracle',
    name: 'The Oracles',
    color: '#c28bff',
    tagline: 'Ancient, defensive, mysterious technology.',
    modifiers: {
      credits: 1,
      minerals: 0.9,
      research: 1.1,
      colonyCost: 1.1,
      growth: 0.9,
      upkeep: 0.7,
    },
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];
