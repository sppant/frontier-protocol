import { create } from 'zustand';

export type RenderMode = '3d' | 'simple';
export type SideTab = 'inspector' | 'research' | 'objectives';

interface ViewState {
  renderMode: RenderMode;
  setRenderMode: (m: RenderMode) => void;
  sideTab: SideTab;
  setSideTab: (t: SideTab) => void;
  tutorialStep: number | null;
  setTutorialStep: (n: number | null) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  renderMode: '3d',
  setRenderMode: (renderMode) => set({ renderMode }),
  sideTab: 'inspector',
  setSideTab: (sideTab) => set({ sideTab }),
  tutorialStep: null,
  setTutorialStep: (tutorialStep) => set({ tutorialStep }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
