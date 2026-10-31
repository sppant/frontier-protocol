import { create } from 'zustand';

interface SelectionState {
  selectedId: string | null;
  hoveredId: string | null;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
}

/** Map interaction state; renderers write here, panels read. */
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedId: null,
  hoveredId: null,
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
}));
