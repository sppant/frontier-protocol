import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { explorationOf } from '@/domain/types';
import { SimpleMap } from '@/render/SimpleMap';
import { createGame } from '@/sim/state';
import { useGameStore } from '@/store/gameStore';
import { useSelectionStore } from '@/store/selectionStore';
import { EventFeed } from './EventFeed';
import { SystemInspector } from './SystemInspector';

describe('expedition workflow', () => {
  beforeEach(() => {
    useGameStore.setState({ game: createGame(2479, 'terran') });
    useSelectionStore.setState({ selectedId: null, hoveredId: null });
  });

  it('launches, travels, and surveys a detected system', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SimpleMap />
        <SystemInspector />
        <EventFeed />
      </>,
    );
    const { game } = useGameStore.getState();
    const target = game.galaxy.systems.find(
      (s) => explorationOf(game.systemStates[s.id], 'terran') === 'detected',
    )!;

    await user.click(screen.getByRole('button', { name: target.name }));
    await user.click(screen.getByRole('button', { name: /Send expedition/ }));

    expect(useGameStore.getState().game.factions.terran.resources.credits).toBe(260);
    expect(screen.getByRole('list', { name: 'Active expeditions' })).toBeInTheDocument();
    expect(screen.getByText(/Expedition launched toward/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send expedition/ })).toBeDisabled();

    act(() => useGameStore.getState().advance(60));

    expect(screen.queryByRole('list', { name: 'Active expeditions' })).not.toBeInTheDocument();
    expect(screen.getByText(/surveyed/)).toBeInTheDocument();
    expect(screen.getByText(/Planets \(/)).toBeInTheDocument();
  });
});
