import type { GameState } from '@/domain/game';

export interface AutosaverOptions {
  save: (game: GameState) => Promise<void>;
  /** Minimum ms between routine (non-forced) saves. */
  intervalMs: number;
  onStatus?: (status: 'saving' | 'saved' | 'error', error?: unknown) => void;
}

/**
 * Throttled autosave. Callers report the latest state with `update`; routine saves
 * happen at most once per `intervalMs` (via `poll`), while `flush` saves immediately
 * at checkpoints (decisions, pauses, tab hide). Writes never overlap: a save requested
 * mid-write is coalesced into one follow-up write of the newest state.
 */
export class Autosaver {
  private latest: GameState | null = null;
  private lastSaved: GameState | null = null;
  private lastSaveAt = -Infinity;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly opts: AutosaverOptions) {}

  get dirty(): boolean {
    return this.latest !== null && this.latest !== this.lastSaved;
  }

  update(game: GameState): void {
    this.latest = game;
  }

  /** Call periodically; saves only if dirty and the interval has elapsed. */
  poll(nowMs: number): Promise<void> {
    return this.dirty && nowMs - this.lastSaveAt >= this.opts.intervalMs
      ? this.flush(nowMs)
      : (this.inFlight ?? Promise.resolve());
  }

  /** Save the newest state now (no-op if nothing changed). */
  flush(nowMs: number = Date.now()): Promise<void> {
    if (this.inFlight) {
      // Chain one follow-up save after the current write finishes.
      this.inFlight = this.inFlight.then(() => (this.dirty ? this.write(nowMs) : undefined));
      return this.inFlight;
    }
    if (!this.dirty) return Promise.resolve();
    this.inFlight = this.write(nowMs).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Forget everything (e.g. when a different game is loaded). */
  reset(game: GameState | null = null): void {
    this.latest = game;
    this.lastSaved = game;
    this.lastSaveAt = -Infinity;
  }

  private async write(nowMs: number): Promise<void> {
    const snapshot = this.latest;
    if (!snapshot) return;
    this.opts.onStatus?.('saving');
    try {
      await this.opts.save(snapshot);
      this.lastSaved = snapshot;
      this.lastSaveAt = nowMs;
      this.opts.onStatus?.('saved');
    } catch (e) {
      this.opts.onStatus?.('error', e);
    }
  }
}
