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
  /** Fleet travel speed multiplier. */
  fleetSpeed: number;
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
    modifiers: {
      credits: 1.05,
      minerals: 1,
      research: 1,
      colonyCost: 0.8,
      growth: 1.2,
      upkeep: 1,
      fleetSpeed: 1,
    },
  },
  helion: {
    id: 'helion',
    name: 'Helion Collective',
    color: '#4fe0a0',
    tagline: 'Research and exploration specialists.',
    modifiers: {
      credits: 1,
      minerals: 1,
      research: 1.3,
      colonyCost: 1,
      growth: 1,
      upkeep: 1,
      fleetSpeed: 1.2,
    },
  },
  veydran: {
    id: 'veydran',
    name: 'Veydran Dominion',
    color: '#ff5a4f',
    tagline: 'Military-oriented, aggressive expansion.',
    modifiers: {
      credits: 0.95,
      minerals: 1.2,
      research: 0.9,
      colonyCost: 1,
      growth: 1,
      upkeep: 1,
      fleetSpeed: 1,
    },
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
      fleetSpeed: 1,
    },
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

const PCT = (m: number) => Math.round(Math.abs(m - 1) * 100);

/** Human-readable strengths/weaknesses derived from a faction's modifiers. */
export function modifierHighlights(m: FactionModifiers): { text: string; good: boolean }[] {
  const rows: { key: keyof FactionModifiers; label: string; lowerIsBetter?: boolean }[] = [
    { key: 'credits', label: 'credit income' },
    { key: 'minerals', label: 'mineral output' },
    { key: 'research', label: 'research' },
    { key: 'colonyCost', label: 'colonization cost', lowerIsBetter: true },
    { key: 'growth', label: 'population growth' },
    { key: 'upkeep', label: 'upkeep', lowerIsBetter: true },
    { key: 'fleetSpeed', label: 'fleet speed' },
  ];
  return rows.flatMap((r) => {
    const v = m[r.key];
    if (PCT(v) === 0) return [];
    const up = v > 1;
    return [{ text: `${up ? '+' : '−'}${PCT(v)}% ${r.label}`, good: r.lowerIsBetter ? !up : up }];
  });
}
