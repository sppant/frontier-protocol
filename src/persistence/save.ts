import { SAVE_VERSION, type GameState } from '@/domain/game';
import { SaveError, validateGameState } from './validate';

export const SAVE_FORMAT = 'frontier-protocol-save';
/** Version of the save *envelope*; bump and add a migration whenever the saved shape changes. */
export const CURRENT_SAVE_VERSION = SAVE_VERSION;

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: string;
  game: unknown;
}

/** Upgrades raw save data one version at a time: key = version it upgrades *from*. */
export type Migrations = Record<number, (envelope: SaveEnvelope) => SaveEnvelope>;

/**
 * Registered migrations (key = version upgraded *from*).
 * v1 → v2: standings history was added to GameState.
 */
export const MIGRATIONS: Migrations = {
  1: (env) => {
    const game =
      typeof env.game === 'object' && env.game !== null
        ? { ...(env.game as Record<string, unknown>), version: 2, history: [] }
        : env.game; // not an object: leave it for validation to reject
    return { ...env, version: 2, game };
  },
};

export function encodeSave(game: GameState, now: Date = new Date()): SaveEnvelope {
  return { format: SAVE_FORMAT, version: CURRENT_SAVE_VERSION, savedAt: now.toISOString(), game };
}

/** Apply migrations until `target`. Refuses unknown formats and saves from the future. */
export function migrate(
  raw: unknown,
  migrations: Migrations = MIGRATIONS,
  target: number = CURRENT_SAVE_VERSION,
): SaveEnvelope {
  if (typeof raw !== 'object' || raw === null) throw new SaveError('Save data is not an object.');
  let env = raw as SaveEnvelope;
  if (env.format !== SAVE_FORMAT) throw new SaveError('Not a Frontier Protocol save.');
  if (!Number.isInteger(env.version) || env.version < 1) {
    throw new SaveError('Save has an invalid version number.');
  }
  if (env.version > target) {
    throw new SaveError(`Save is from a newer version of the game (v${env.version}).`);
  }
  while (env.version < target) {
    const step = migrations[env.version];
    if (!step) throw new SaveError(`No migration from save version ${env.version}.`);
    const from = env.version;
    env = step(env);
    if (env.version <= from)
      throw new SaveError(`Migration from v${from} did not advance the version.`);
  }
  return env;
}

export interface LoadedSave {
  game: GameState;
  savedAt: string;
}

/** Migrate then validate untrusted stored data. Throws SaveError on any problem. */
export function decodeSave(raw: unknown, migrations?: Migrations, target?: number): LoadedSave {
  const env = migrate(raw, migrations, target);
  if (typeof env.savedAt !== 'string' || Number.isNaN(Date.parse(env.savedAt))) {
    throw new SaveError('Save has an invalid timestamp.');
  }
  return { game: validateGameState(env.game), savedAt: env.savedAt };
}
