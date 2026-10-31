import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { newGame } from '@/engine/step';
import { useGameStore } from '@/store/gameStore';
import { ObjectivesPanel } from './ObjectivesPanel';

describe('ObjectivesPanel', () => {
  beforeEach(() => useGameStore.setState({ game: newGame(2479, 'terran', 'normal') }));

  it('shows chapter, victory paths and standings for every faction', () => {
    render(<ObjectivesPanel />);
    expect(screen.getByText('First Contact')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Dominion progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    const standings = screen.getByRole('table', { name: 'Standings' });
    expect(standings).toHaveTextContent('Terran Directorate (you)');
    expect(standings).toHaveTextContent('Veydran Dominion');
  });

  it('describes the score chart in text for assistive tech (and works without canvas)', async () => {
    render(<ObjectivesPanel />);
    const chart = await screen.findByRole('img', {
      name: /Score over time. Latest: .*Terran Directorate \d+/,
    });
    expect(chart).toBeInTheDocument();
  });
});
