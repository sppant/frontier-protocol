import { create } from 'zustand';

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

interface ClockState {
  paused: boolean;
  speed: Speed;
  togglePause: () => void;
  setSpeed: (speed: Speed) => void;
}

/** Player-facing simulation clock controls. The sim loop will read these. */
export const useClockStore = create<ClockState>((set) => ({
  paused: true,
  speed: 1,
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setSpeed: (speed) => set({ speed }),
}));
