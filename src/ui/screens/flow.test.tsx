import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import { newGame } from '@/engine/step';
import { AUTOSAVE_SLOT, saveGame } from '@/persistence/saveGame';
import { MemoryStore } from '@/persistence/storage';
import { useAppStore } from '@/store/appStore';
import { useClockStore } from '@/store/clockStore';
import { useGameStore } from '@/store/gameStore';
import { setSaveStore } from '@/store/session';
import { useViewStore } from '@/store/viewStore';

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
  setSaveStore(store);
  localStorage.clear();
  useAppStore.setState({
    screen: 'boot',
    summary: null,
    loadError: null,
    saveStatus: 'idle',
    lastSavedAt: null,
  });
  useViewStore.setState({ tutorialStep: null, settingsOpen: false, sideTab: 'inspector' });
  useClockStore.setState({ paused: true, speed: 1 });
});
afterEach(() => localStorage.clear());

async function startMatch(user: ReturnType<typeof userEvent.setup>, faction: RegExp = /Helion/) {
  await user.click(await screen.findByRole('button', { name: 'New game' }));
  await user.click(screen.getByRole('radio', { name: faction }));
  await user.click(screen.getByRole('radio', { name: /Hard/ }));
  await user.click(screen.getByRole('button', { name: /^Begin as/ }));
  await screen.findByRole('region', { name: 'Galaxy map' });
}

describe('start flow', () => {
  it('first launch offers only a new game', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'New game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('lets the player pick a faction and difficulty, then starts that match', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startMatch(user, /Veydran/);
    const { game } = useGameStore.getState();
    expect(game.playerFaction).toBe('veydran');
    expect(Object.keys(game.bots)).toHaveLength(3);
    expect(Object.values(game.bots).every((b) => b?.difficulty === 'hard')).toBe(true);
    expect(game.bots.veydran).toBeUndefined();
    expect(screen.getAllByText('Veydran Dominion').length).toBeGreaterThan(0);
    expect(useClockStore.getState().paused).toBe(true);
  });

  it('explains faction differences on the setup screen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'New game' }));
    const helion = screen.getByRole('radio', { name: /Helion/ });
    expect(within(helion).getByText('+30% research')).toBeInTheDocument();
    expect(within(helion).getByText(/Unique tech/)).toBeInTheDocument();
  });

  it('validates the seed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'New game' }));
    const seed = screen.getByLabelText('Galaxy seed');
    await user.clear(seed);
    await user.type(seed, 'abc');
    expect(screen.getByRole('button', { name: /^Begin as/ })).toBeDisabled();
    await user.clear(seed);
    await user.type(seed, '777');
    expect(screen.getByRole('button', { name: /^Begin as/ })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /^Begin as/ }));
    await screen.findByRole('region', { name: 'Galaxy map' });
    expect(useGameStore.getState().game.seed).toBe(777);
  });
});

describe('onboarding', () => {
  it('walks through the steps once and remembers it was seen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startMatch(user);
    const tutorial = await screen.findByRole('region', { name: 'Tutorial' });
    expect(within(tutorial).getByText('Welcome, Commander')).toBeInTheDocument();
    await user.click(within(tutorial).getByRole('button', { name: 'Next' }));
    expect(within(tutorial).getByText('The galaxy map')).toBeInTheDocument();
    await user.click(within(tutorial).getByRole('button', { name: 'Back' }));
    expect(within(tutorial).getByText('Welcome, Commander')).toBeInTheDocument();
    await user.click(within(tutorial).getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('region', { name: 'Tutorial' })).not.toBeInTheDocument();
    expect(localStorage.getItem('fp.tutorialSeen')).toBe('1');
  });

  it('is not shown again for later matches, but can be replayed from Settings', async () => {
    localStorage.setItem('fp.tutorialSeen', '1');
    const user = userEvent.setup();
    render(<App />);
    await startMatch(user);
    expect(screen.queryByRole('region', { name: 'Tutorial' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Show again' }));
    expect(await screen.findByRole('region', { name: 'Tutorial' })).toBeInTheDocument();
  });
});

describe('saving and continuing', () => {
  it('saves a new match immediately and offers Continue after quitting to the menu', async () => {
    localStorage.setItem('fp.tutorialSeen', '1');
    const user = userEvent.setup();
    render(<App />);
    await startMatch(user, /Oracles/);
    await waitFor(() => expect(useAppStore.getState().saveStatus).toBe('saved'));
    expect(await store.read(AUTOSAVE_SLOT)).toBeDefined();

    // Play a bit, then leave via Settings.
    act(() => useGameStore.getState().advance(3));
    const dayBefore = useGameStore.getState().game.tick;
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Main menu' }));
    const cont = await screen.findByRole('button', { name: 'Continue' });
    expect(cont).toHaveTextContent('The Oracles');
    expect(cont).toHaveTextContent(`Day ${dayBefore}`);

    // Simulate a fresh page load: wipe in-memory game, then continue from storage.
    useGameStore.setState({ game: newGame(1, 'terran', 'easy') });
    await user.click(cont);
    await screen.findByRole('region', { name: 'Galaxy map' });
    const restored = useGameStore.getState().game;
    expect(restored.playerFaction).toBe('oracle');
    expect(restored.tick).toBe(dayBefore);
    expect(useClockStore.getState().paused).toBe(true);
  });

  it('shows Continue on launch when a valid save exists', async () => {
    await saveGame(store, { ...newGame(5, 'helion', 'normal'), tick: 42 });
    render(<App />);
    const cont = await screen.findByRole('button', { name: 'Continue' });
    expect(cont).toHaveTextContent('Helion Collective');
    expect(cont).toHaveTextContent('Day 42');
  });

  it('survives a corrupted save: explains it and lets the player discard it', async () => {
    await store.write(AUTOSAVE_SLOT, {
      format: 'frontier-protocol-save',
      version: 1,
      savedAt: new Date().toISOString(),
      game: { nonsense: true },
    });
    const user = userEvent.setup();
    render(<App />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be loaded/i);
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard broken save' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await store.read(AUTOSAVE_SLOT)).toBeUndefined();
    // And a new game is still possible.
    expect(screen.getByRole('button', { name: 'New game' })).toBeInTheDocument();
  });
});

describe('settings dialog', () => {
  it('opens, switches map mode, and closes with Escape', async () => {
    localStorage.setItem('fp.tutorialSeen', '1');
    const user = userEvent.setup();
    render(<App />);
    await startMatch(user);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    await user.click(within(dialog).getByRole('button', { name: 'Simple 2D' }));
    expect(useViewStore.getState().renderMode).toBe('simple');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
    useViewStore.setState({ renderMode: '3d' });
  });
});
