import type { GameState } from '@/domain/game';
import { decodeSave, encodeSave, type LoadedSave } from './save';
import type { SaveStore } from './storage';
import { SaveError } from './validate';

export const AUTOSAVE_SLOT = 'autosave';

export type LoadResult =
  { status: 'none' } | { status: 'ok'; save: LoadedSave } | { status: 'corrupt'; reason: string };

export async function saveGame(store: SaveStore, game: GameState, slot = AUTOSAVE_SLOT) {
  await store.write(slot, encodeSave(game));
}

/** Never throws: a missing, unreadable or invalid save is reported as a result. */
export async function loadGame(store: SaveStore, slot = AUTOSAVE_SLOT): Promise<LoadResult> {
  let raw: unknown;
  try {
    raw = await store.read(slot);
  } catch (e) {
    return {
      status: 'corrupt',
      reason: `Storage error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (raw === undefined) return { status: 'none' };
  try {
    return { status: 'ok', save: decodeSave(raw) };
  } catch (e) {
    const reason = e instanceof SaveError ? e.message : 'Save data could not be read.';
    return { status: 'corrupt', reason };
  }
}

export async function deleteSave(store: SaveStore, slot = AUTOSAVE_SLOT) {
  await store.remove(slot);
}
