import { useCallback } from 'react';
import { explorationOf, type ExplorationStatus } from '@/domain/types';
import { useGameStore } from './gameStore';

/** Returns a lookup of what the player currently knows about a system (fog of war). */
export function useExploration(): (systemId: string) => ExplorationStatus {
  const states = useGameStore((s) => s.game.systemStates);
  const player = useGameStore((s) => s.game.playerFaction);
  return useCallback((id) => explorationOf(states[id], player), [states, player]);
}
