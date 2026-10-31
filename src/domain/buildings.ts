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
