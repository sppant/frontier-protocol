import { advanceClock } from '@/sim/clock';
import { useClockStore } from './clockStore';
import { useGameStore } from './gameStore';

const POLL_MS = 100;

/**
 * Drives the simulation from wall-clock time (not requestAnimationFrame), so game
 * speed is independent of rendering. Returns a stop function.
 */
export function startGameLoop(): () => void {
  let acc = 0;
  let last = performance.now();
  const id = setInterval(() => {
    const now = performance.now();
    const { paused, speed } = useClockStore.getState();
    const step = advanceClock(acc, now - last, speed, paused);
    last = now;
    acc = step.accMs;
    if (step.ticks > 0) useGameStore.getState().advance(step.ticks);
  }, POLL_MS);
  return () => clearInterval(id);
}
