import { beforeEach, describe, expect, it } from 'vitest';
import { useClockStore } from './clockStore';

describe('clockStore', () => {
  beforeEach(() => useClockStore.setState({ paused: true, speed: 1 }));

  it('starts paused at 1x', () => {
    const { paused, speed } = useClockStore.getState();
    expect(paused).toBe(true);
    expect(speed).toBe(1);
  });

  it('toggles pause', () => {
    useClockStore.getState().togglePause();
    expect(useClockStore.getState().paused).toBe(false);
    useClockStore.getState().togglePause();
    expect(useClockStore.getState().paused).toBe(true);
  });

  it('sets speed', () => {
    useClockStore.getState().setSpeed(4);
    expect(useClockStore.getState().speed).toBe(4);
  });
});
