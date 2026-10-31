import { create } from 'zustand';
import type { BuildingId, GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { colonize, startConstruction, type CommandResult } from '@/sim/commands';
import { launchExpedition } from '@/sim/fleets';
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
  expedition: (targetId: string) => CommandResult;
  newGame: (seed: number, faction: FactionId) => void;
}

/** Holds the authoritative GameState. Game rules live in `sim/`, never here. */
export const useGameStore = create<GameStore>((set, get) => {
  /** Run a pure command against the current state and commit it on success. */
  const run = (command: (game: GameState) => CommandResult): CommandResult => {
    const result = command(get().game);
    if (result.ok) set({ game: result.state });
    return result;
  };
  return {
    game: createGame(DEFAULT_SEED, 'terran'),
    advance: (ticks) => set((s) => ({ game: advance(s.game, ticks) })),
    colonize: (planetId) => run((g) => colonize(g, g.playerFaction, planetId)),
    build: (colonyId, building) =>
      run((g) => startConstruction(g, g.playerFaction, colonyId, building)),
    expedition: (targetId) => run((g) => launchExpedition(g, g.playerFaction, targetId)),
    newGame: (seed, faction) => set({ game: createGame(seed, faction) }),
  };
});
