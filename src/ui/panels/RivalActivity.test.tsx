import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { advanceGame, newGame } from '@/engine/step';
import { useGameStore } from '@/store/gameStore';
import { EventFeed } from './EventFeed';

describe('rival activity feed', () => {
  beforeEach(() => useGameStore.setState({ game: newGame(2479, 'terran', 'normal') }));

  it('says nothing has happened before the bots act', async () => {
    render(<EventFeed />);
    await userEvent.click(screen.getByRole('tab', { name: 'Rival activity' }));
    expect(screen.getByText(/have not made any moves/)).toBeInTheDocument();
  });

  it('lists bot decisions with their personality and reason', async () => {
    // Skip the day-1 story event: move to day 2 while resolving nothing, bots wait on pending events.
    let g = newGame(2479, 'terran', 'normal');
    g = { ...g, pendingEvent: null, storyStage: 99 };
    useGameStore.setState({ game: advanceGame(g, 30) });
    render(<EventFeed />);
    await userEvent.click(screen.getByRole('tab', { name: 'Rival activity' }));
    const list = screen.getByRole('list', { name: 'Rival activity' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(3);
    expect(list).toHaveTextContent(/Pioneer|Warlord|Oracle/);
    expect(list).toHaveTextContent(/[a-z]+ [+-]\d\.\d\d/); // reason breakdown, e.g. "exploration +0.73"
  });
});
