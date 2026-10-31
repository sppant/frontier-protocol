import type { BuildingDef, BuildingId } from './game';

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  mine: {
    id: 'mine',
    name: 'Mining Complex',
    description: 'Extracts minerals. Output scales with the planet’s mineral richness.',
    cost: { credits: 60, minerals: 30, research: 0 },
    buildTicks: 8,
    upkeep: 0.5,
  },
  lab: {
    id: 'lab',
    name: 'Research Lab',
    description: 'Generates research. Output scales with population.',
    cost: { credits: 80, minerals: 40, research: 0 },
    buildTicks: 10,
    upkeep: 0.5,
  },
  tradeHub: {
    id: 'tradeHub',
    name: 'Trade Hub',
    description: 'Generates credits. Output scales with population.',
    cost: { credits: 70, minerals: 20, research: 0 },
    buildTicks: 8,
    upkeep: 0.5,
  },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Highest building level (built = 1, two upgrades possible). */
export const MAX_BUILDING_LEVEL = 3;
/** Output multiplier bonus per level above 1. */
export const LEVEL_OUTPUT_BONUS = 0.5;
/** Upkeep grows with level by the same fraction. */
export const LEVEL_UPKEEP_BONUS = 0.5;
/** Upgrade cost = base cost × this × current level. */
export const UPGRADE_COST_FACTOR = 1.5;

/** Terraforming: each step adds this much habitability, up to the cap. */
export const TERRAFORM_STEP = 10;
export const MAX_TERRAFORM = 30;
export const TERRAFORM_COST = { credits: 150, minerals: 100, research: 0 };
export const TERRAFORM_TICKS = 15;
