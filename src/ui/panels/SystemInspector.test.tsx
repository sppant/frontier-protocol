import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SimpleMap } from '@/render/SimpleMap';
import { useGameStore } from '@/store/gameStore';
import { useSelectionStore } from '@/store/selectionStore';
import { SystemInspector } from './SystemInspector';

function Harness() {
  return (
    <>
      <SimpleMap />
      <SystemInspector />
    </>
  );
}

describe('map ↔ inspector boundary', () => {
  beforeEach(() => useSelectionStore.setState({ selectedId: null, hoveredId: null }));

  it('prompts when nothing is selected', () => {
    render(<Harness />);
    expect(screen.getByText(/select a star system/i)).toBeInTheDocument();
  });

  it('shows full details for the explored home system', async () => {
    const { galaxy, playerFaction } = useGameStore.getState().game;
    const home = galaxy.systems.find((s) => s.homeOf === playerFaction)!;
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: home.name }));
    expect(useSelectionStore.getState().selectedId).toBe(home.id);
    expect(screen.getByRole('heading', { name: home.name })).toBeInTheDocument();
    expect(screen.getByText(/Planets \(/)).toBeInTheDocument();
    expect(screen.getByText('Terran Directorate')).toBeInTheDocument();
  });

  it('keeps unknown systems anonymous', async () => {
    const { galaxy, systemStates } = useGameStore.getState().game;
    const unknown = galaxy.systems.find((s) => systemStates[s.id]?.exploration === 'unknown')!;
    render(<Harness />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Unknown system' })[0]!);
    expect(useSelectionStore.getState().selectedId).not.toBeNull();
    expect(screen.queryByText(unknown.name)).not.toBeInTheDocument();
    expect(screen.getByText(/beyond sensor range|Send an expedition/)).toBeInTheDocument();
  });
});
