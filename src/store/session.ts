import type { Difficulty } from '@/domain/bots';
import type { GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { newGame } from '@/engine/step';
import { Autosaver } from '@/persistence/autosave';
import { deleteSave, loadGame, saveGame } from '@/persistence/saveGame';
import { createDefaultStore, type SaveStore } from '@/persistence/storage';
import { useAppStore, type SaveSummary } from './appStore';
import { useClockStore } from './clockStore';
import { useGameStore } from './gameStore';
import { useSelectionStore } from './selectionStore';

/** Routine autosave cadence; checkpoints (decisions, pause, tab hide) save immediately. */
export const AUTOSAVE_INTERVAL_MS = 5000;

const defaults = createDefaultStore();
let store: SaveStore = defaults.store;
let autosaver: Autosaver | null = null;

/** Swap the storage backend (tests). */
export function setSaveStore(s: SaveStore): void {
  store = s;
}

function summarize(game: GameState, savedAt: string): SaveSummary {
  const bot = Object.values(game.bots)[0];
  return {
    savedAt,
    day: game.tick,
    faction: game.playerFaction,
    difficulty: bot?.difficulty ?? null,
  };
}

function resetUiState(game: GameState): void {
  useGameStore.setState({ game });
  useClockStore.setState({ paused: true, speed: 1 });
  useSelectionStore.setState({ selectedId: null, hoveredId: null });
  autosaver?.reset(game);
}

/** Check for a stored save and land on the main menu. */
export async function bootSession(): Promise<void> {
  useAppStore.getState().patch({ persistent: defaults.persistent });
  const result = await loadGame(store);
  const app = useAppStore.getState();
  if (result.status === 'ok') {
    app.patch({ summary: summarize(result.save.game, result.save.savedAt), loadError: null });
  } else if (result.status === 'corrupt') {
    app.patch({ summary: null, loadError: result.reason });
  } else {
    app.patch({ summary: null, loadError: null });
  }
  app.setScreen('menu');
}

export async function startNewGame(opts: {
  seed: number;
  faction: FactionId;
  difficulty: Difficulty;
}): Promise<void> {
  const game = newGame(opts.seed, opts.faction, opts.difficulty);
  resetUiState(game);
  useAppStore.getState().patch({ loadError: null });
  useAppStore.getState().setScreen('game');
  // A brand-new match is saved straight away so Continue works even after an instant reload.
  autosaver?.reset(null);
  autosaver?.update(game);
  await autosaver?.flush();
}

export async function continueGame(): Promise<boolean> {
  const result = await loadGame(store);
  if (result.status !== 'ok') {
    useAppStore.getState().patch({
      loadError: result.status === 'corrupt' ? result.reason : 'No saved game found.',
      summary: null,
    });
    return false;
  }
  resetUiState(result.save.game);
  useAppStore.getState().setScreen('game');
  return true;
}

export async function discardSave(): Promise<void> {
  await deleteSave(store);
  useAppStore.getState().patch({ summary: null, loadError: null, lastSavedAt: null });
}

/** Save immediately (Settings → Save now, quitting to the menu). */
export async function saveNow(): Promise<void> {
  await autosaver?.flush();
}

export async function quitToMenu(): Promise<void> {
  useClockStore.setState({ paused: true });
  await saveNow();
  const result = await loadGame(store);
  useAppStore.getState().patch({
    summary: result.status === 'ok' ? summarize(result.save.game, result.save.savedAt) : null,
  });
  useAppStore.getState().setScreen('menu');
}

/** Wire autosave to the stores and the page lifecycle. Returns a disposer. */
export function startAutosave(): () => void {
  autosaver = new Autosaver({
    intervalMs: AUTOSAVE_INTERVAL_MS,
    save: (game) => saveGame(store, game),
    onStatus: (status) => {
      const app = useAppStore.getState();
      app.patch(
        status === 'saved'
          ? { saveStatus: 'saved', lastSavedAt: new Date().toISOString() }
          : { saveStatus: status },
      );
    },
  });
  autosaver.reset(useGameStore.getState().game);
  const saver = autosaver;
  let lastGame = useGameStore.getState().game;

  const unsubGame = useGameStore.subscribe((s) => {
    if (s.game === lastGame) return;
    const prev = lastGame;
    lastGame = s.game;
    // Only persist while a match is on screen.
    if (useAppStore.getState().screen !== 'game') return;
    saver.update(s.game);
    const decided = prev.pendingEvent !== null && s.game.pendingEvent === null;
    const ended = !prev.victory && s.game.victory !== null;
    if (decided || ended) void saver.flush();
  });
  const unsubClock = useClockStore.subscribe((s, prev) => {
    if (s.paused && !prev.paused && useAppStore.getState().screen === 'game') void saver.flush();
  });
  const timer = setInterval(() => {
    if (useAppStore.getState().screen === 'game') void saver.poll(Date.now());
  }, 1000);
  const onHide = () => {
    if (document.visibilityState === 'hidden') void saver.flush();
  };
  const onPageHide = () => void saver.flush();
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    unsubGame();
    unsubClock();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
    autosaver = null;
  };
}
