import { create } from 'zustand';
import type { Difficulty } from '@/domain/bots';
import type { FactionId } from '@/domain/types';

export type Screen = 'boot' | 'menu' | 'setup' | 'game';

export interface SaveSummary {
  savedAt: string;
  day: number;
  faction: FactionId;
  difficulty: Difficulty | null;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AppState {
  screen: Screen;
  /** Summary of the stored autosave, if a valid one exists. */
  summary: SaveSummary | null;
  /** Why the stored save could not be used, if it was corrupt. */
  loadError: string | null;
  /** False if IndexedDB is unavailable and saves will not survive a reload. */
  persistent: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  setScreen: (s: Screen) => void;
  patch: (p: Partial<Omit<AppState, 'setScreen' | 'patch'>>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: 'boot',
  summary: null,
  loadError: null,
  persistent: true,
  saveStatus: 'idle',
  lastSavedAt: null,
  setScreen: (screen) => set({ screen }),
  patch: (p) => set(p),
}));
