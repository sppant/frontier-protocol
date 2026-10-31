import type { FactionId } from './types';

export interface FactionInfo {
  id: FactionId;
  name: string;
  /** Hex color; keep in sync with --faction-* tokens in styles/tokens.css. */
  color: string;
  tagline: string;
}

export const FACTIONS: Record<FactionId, FactionInfo> = {
  terran: {
    id: 'terran',
    name: 'Terran Directorate',
    color: '#4aa3ff',
    tagline: 'Balanced economy, strong colonization.',
  },
  helion: {
    id: 'helion',
    name: 'Helion Collective',
    color: '#4fe0a0',
    tagline: 'Research and exploration specialists.',
  },
  veydran: {
    id: 'veydran',
    name: 'Veydran Dominion',
    color: '#ff5a4f',
    tagline: 'Military-oriented, aggressive expansion.',
  },
  oracle: {
    id: 'oracle',
    name: 'The Oracles',
    color: '#c28bff',
    tagline: 'Ancient, defensive, mysterious technology.',
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];
