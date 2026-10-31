import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useClockStore } from '@/store/clockStore';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  beforeEach(() => useClockStore.setState({ paused: true, speed: 1 }));

  it('renders the main regions', () => {
    render(<AppShell />);
    expect(screen.getByText('FRONTIER PROTOCOL')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Galaxy map' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Inspector' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Event feed' })).toBeInTheDocument();
  });

  it('toggles simulation status and speed', async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    expect(screen.getByTestId('sim-status')).toHaveTextContent('Paused');
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByTestId('sim-status')).toHaveTextContent('Running');
    await user.click(screen.getByRole('button', { name: 'Speed 4x' }));
    expect(useClockStore.getState().speed).toBe(4);
  });
});
