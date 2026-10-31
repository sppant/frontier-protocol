import type { FactionId } from './types';
import type { TechId } from './game';

export type ModifierKey =
  'credits' | 'minerals' | 'research' | 'colonyCost' | 'growth' | 'upkeep' | 'fleetSpeed';

export interface TechDef {
  id: TechId;
  name: string;
  description: string;
  /** Research points, paid once on purchase. */
  cost: number;
  requires: TechId[];
  /** Only this faction can research it. */
  faction?: FactionId;
  /** Requires the story to have reached this stage (see STORY_SCHEDULE). */
  requiresStory?: number;
  /** Multipliers applied on top of the faction's base modifiers. */
  mult?: Partial<Record<ModifierKey, number>>;
  /** Extra hops of neighbouring systems revealed when surveying. */
  surveyReach?: number;
  /** Researching this wins the game (Nexus Ascendancy). */
  capstone?: boolean;
}

export const TECHS: TechDef[] = [
  {
    id: 'deepCore',
    name: 'Deep Core Extraction',
    description: '+25% mineral output.',
    cost: 40,
    requires: [],
    mult: { minerals: 1.25 },
  },
  {
    id: 'orbitalMarkets',
    name: 'Orbital Markets',
    description: '+15% credit income.',
    cost: 50,
    requires: [],
    mult: { credits: 1.15 },
  },
  {
    id: 'colonialLogistics',
    name: 'Colonial Logistics',
    description: 'Colonization costs 20% less.',
    cost: 60,
    requires: [],
    mult: { colonyCost: 0.8 },
  },
  {
    id: 'bioHabitats',
    name: 'Bio-Habitats',
    description: '+30% population growth.',
    cost: 70,
    requires: [],
    mult: { growth: 1.3 },
  },
  {
    id: 'expeditionDrives',
    name: 'Expedition Drives',
    description: 'Scout fleets travel 50% faster.',
    cost: 60,
    requires: [],
    mult: { fleetSpeed: 1.5 },
  },
  {
    id: 'fusionGrid',
    name: 'Fusion Grid',
    description: 'Upkeep costs 20% less.',
    cost: 90,
    requires: ['deepCore'],
    mult: { upkeep: 0.8 },
  },
  {
    id: 'quantumLabs',
    name: 'Quantum Labs',
    description: '+25% research output.',
    cost: 100,
    requires: ['orbitalMarkets'],
    mult: { research: 1.25 },
  },
  {
    id: 'nexusCartography',
    name: 'Nexus Cartography',
    description: 'Surveys also reveal systems two hops away.',
    cost: 120,
    requires: ['expeditionDrives'],
    surveyReach: 1,
  },
  {
    id: 'nexusAttunement',
    name: 'Nexus Attunement',
    description: 'Interface directly with the Nexus. Victory: Nexus Ascendancy.',
    cost: 500,
    requires: ['nexusCartography', 'quantumLabs', 'fusionGrid'],
    requiresStory: 5,
    capstone: true,
  },
  // Faction-unique technologies
  {
    id: 'rapidCharters',
    name: 'Rapid Charters',
    description: 'Terran: colonization 15% cheaper, +15% growth.',
    cost: 80,
    requires: [],
    faction: 'terran',
    mult: { colonyCost: 0.85, growth: 1.15 },
  },
  {
    id: 'deepSurvey',
    name: 'Deep Survey Arrays',
    description: 'Helion: scouts 30% faster, +10% research.',
    cost: 80,
    requires: [],
    faction: 'helion',
    mult: { fleetSpeed: 1.3, research: 1.1 },
  },
  {
    id: 'warEconomy',
    name: 'War Economy',
    description: 'Veydran: +20% minerals, 10% less upkeep.',
    cost: 80,
    requires: [],
    faction: 'veydran',
    mult: { minerals: 1.2, upkeep: 0.9 },
  },
  {
    id: 'precursorResonance',
    name: 'Precursor Resonance',
    description: 'Oracle: +20% research, +5% credits.',
    cost: 80,
    requires: [],
    faction: 'oracle',
    mult: { research: 1.2, credits: 1.05 },
  },
];

export const TECH_BY_ID: Record<TechId, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));
