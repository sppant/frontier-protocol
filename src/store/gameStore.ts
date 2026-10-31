import { create } from 'zustand';
import type { BuildingId, GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { colonize, startConstruction, type CommandResult } from '@/sim/commands';
import { resolveEvent } from '@/sim/events';
import { launchExpedition } from '@/sim/fleets';
import { researchTech } from '@/sim/research';
import { advanceGame, newGame } from '@/engine/step';

export const DEFAULT_SEED = 2479;

interface GameStore {
  game: GameState;
  /** Advance the simulation by whole ticks. */
  advance: (ticks: number) => void;
  /** Player commands; return the outcome so the UI can explain failures. */
  colonize: (planetId: string) => CommandResult;
  build: (colonyId: string, building: BuildingId) => CommandResult;
  expedition: (targetId: string) => CommandResult;
  research: (techId: string) => CommandResult;
  resolveEvent: (choiceId: string) => CommandResult;
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
    game: newGame(DEFAULT_SEED, 'terran'),
    advance: (ticks) => set((s) => ({ game: advanceGame(s.game, ticks) })),
    colonize: (planetId) => run((g) => colonize(g, g.playerFaction, planetId)),
    build: (colonyId, building) =>
      run((g) => startConstruction(g, g.playerFaction, colonyId, building)),
    expedition: (targetId) => run((g) => launchExpedition(g, g.playerFaction, targetId)),
    research: (techId) => run((g) => researchTech(g, g.playerFaction, techId)),
    resolveEvent: (choiceId) => run((g) => resolveEvent(g, choiceId)),
    newGame: (seed, faction) => set({ game: newGame(seed, faction) }),
  };
});
