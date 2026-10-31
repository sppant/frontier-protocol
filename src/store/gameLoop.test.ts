import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '@/engine/step';
import { useClockStore } from './clockStore';
import { startGameLoop } from './gameLoop';
import { useGameStore } from './gameStore';

describe('game loop', () => {
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState({ game: newGame(2479, 'terran', 'normal') });
    useClockStore.setState({ paused: false, speed: 4 });
    stop = startGameLoop();
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('advances time at the selected speed', () => {
    useGameStore.setState({ game: { ...useGameStore.getState().game, storyStage: 99 } });
    vi.advanceTimersByTime(2000); // 2s × 4 = 8 days
    expect(useGameStore.getState().game.tick).toBe(8);
  });

  it('does not advance while paused', () => {
    useClockStore.setState({ paused: true });
    vi.advanceTimersByTime(5000);
    expect(useGameStore.getState().game.tick).toBe(0);
  });

  it('pauses synchronously when a decision opens, even mid-batch', () => {
    // A long stall would batch many ticks; the loop must stop at the event and pause at once.
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(5000);
    const { game } = useGameStore.getState();
    expect(game.pendingEvent?.eventId).toBe('firstContact');
    expect(game.tick).toBe(1);
    expect(useClockStore.getState().paused).toBe(true);
  });
});
