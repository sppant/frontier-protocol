/** Real milliseconds per game tick at 1× speed. */
export const TICK_MS = 1000;
/** Cap per step so a throttled/backgrounded tab can't trigger a huge catch-up burst. */
export const MAX_TICKS_PER_STEP = 30;

export interface ClockStep {
  ticks: number;
  accMs: number;
}

/** Converts elapsed real time into whole simulation ticks. Independent of rendering. */
export function advanceClock(
  accMs: number,
  deltaMs: number,
  speed: number,
  paused: boolean,
): ClockStep {
  if (paused) return { ticks: 0, accMs: 0 };
  const total = accMs + Math.max(0, deltaMs) * speed;
  const ticks = Math.min(MAX_TICKS_PER_STEP, Math.floor(total / TICK_MS));
  return { ticks, accMs: ticks === MAX_TICKS_PER_STEP ? 0 : total - ticks * TICK_MS };
}
