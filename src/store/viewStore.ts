import { create } from 'zustand';

export type RenderMode = '3d' | 'simple';

interface ViewState {
  renderMode: RenderMode;
  setRenderMode: (m: RenderMode) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  renderMode: '3d',
  setRenderMode: (renderMode) => set({ renderMode }),
}));
