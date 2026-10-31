import { create } from 'zustand';
import type { FactionId, Galaxy, SystemState } from '@/domain/types';
import { createInitialSystemStates, generateGalaxy } from '@/sim/galaxyGen';

export const DEFAULT_SEED = 2479;

interface GalaxyState {
  galaxy: Galaxy;
  systemStates: Record<string, SystemState>;
  playerFaction: FactionId;
  selectedId: string | null;
  hoveredId: string | null;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
}

function initial(seed: number, faction: FactionId) {
  const galaxy = generateGalaxy(seed);
  return { galaxy, systemStates: createInitialSystemStates(galaxy, faction) };
}

/** Bridge between the simulation state and the map/inspector. Renderers only select/hover. */
export const useGalaxyStore = create<GalaxyState>((set) => ({
  ...initial(DEFAULT_SEED, 'terran'),
  playerFaction: 'terran',
  selectedId: null,
  hoveredId: null,
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
}));
