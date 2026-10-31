import { advanceClock } from '@/sim/clock';
import { useClockStore } from './clockStore';
import { useGameStore } from './gameStore';

const POLL_MS = 100;

/** A pending decision or a finished match halts time until the player acts. */
function haltIfBlocked(): void {
  const { game } = useGameStore.getState();
  if ((game.pendingEvent || game.victory) && !useClockStore.getState().paused) {
    useClockStore.setState({ paused: true });
  }
}

/**
 * Drives the simulation from wall-clock time (not requestAnimationFrame), so game
 * speed is independent of rendering. Returns a stop function.
 */
export function startGameLoop(): () => void {
  let acc = 0;
  let last = performance.now();
  const id = setInterval(() => {
    const now = performance.now();
    haltIfBlocked();
    const { paused, speed } = useClockStore.getState();
    const step = advanceClock(acc, now - last, speed, paused);
    last = now;
    acc = step.accMs;
    if (step.ticks > 0) {
      useGameStore.getState().advance(step.ticks);
      haltIfBlocked(); // pause synchronously so the player's reply can never race the loop
    }
  }, POLL_MS);
  return () => clearInterval(id);
}
