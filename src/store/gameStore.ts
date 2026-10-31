import { create } from 'zustand';
import type { BuildingId, GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { colonize, startConstruction, type CommandResult } from '@/sim/commands';
import { createGame } from '@/sim/state';
import { advance } from '@/sim/tick';

export const DEFAULT_SEED = 2479;

interface GameStore {
  game: GameState;
  /** Advance the simulation by whole ticks. */
  advance: (ticks: number) => void;
  /** Player commands; return the outcome so the UI can explain failures. */
  colonize: (planetId: string) => CommandResult;
  build: (colonyId: string, building: BuildingId) => CommandResult;
  newGame: (seed: number, faction: FactionId) => void;
}

/** Holds the authoritative GameState. Game rules live in `sim/`, never here. */
export const useGameStore = create<GameStore>((set, get) => ({
  game: createGame(DEFAULT_SEED, 'terran'),
  advance: (ticks) => set((s) => ({ game: advance(s.game, ticks) })),
  colonize: (planetId) => {
    const { game } = get();
    const result = colonize(game, game.playerFaction, planetId);
    if (result.ok) set({ game: result.state });
    return result;
  },
  build: (colonyId, building) => {
    const { game } = get();
    const result = startConstruction(game, game.playerFaction, colonyId, building);
    if (result.ok) set({ game: result.state });
    return result;
  },
  newGame: (seed, faction) => set({ game: createGame(seed, faction) }),
}));
