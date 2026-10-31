import { FACTIONS, type FactionModifiers } from '@/domain/factions';
import type { GameState } from '@/domain/game';
import { TECH_BY_ID } from '@/domain/techs';
import type { FactionId } from '@/domain/types';

/** Faction base modifiers multiplied by every researched technology. */
export function modifiersFor(state: GameState, factionId: FactionId): FactionModifiers {
  const mods = { ...FACTIONS[factionId].modifiers };
  for (const id of state.factions[factionId].techs) {
    const mult = TECH_BY_ID[id]?.mult;
    if (!mult) continue;
    for (const key of Object.keys(mult) as (keyof FactionModifiers)[]) {
      mods[key] *= mult[key] ?? 1;
    }
  }
  return mods;
}

/** How many hops of neighbouring systems a survey reveals (1 = direct neighbours). */
export function surveyReachFor(state: GameState, factionId: FactionId): number {
  return state.factions[factionId].techs.reduce(
    (reach, id) => reach + (TECH_BY_ID[id]?.surveyReach ?? 0),
    1,
  );
}

/** Lowest planet habitability this faction can colonize. */
export const BASE_MIN_HABITABILITY = 20;
export function minHabitabilityFor(state: GameState, factionId: FactionId): number {
  return state.factions[factionId].techs.reduce(
    (min, id) => Math.min(min, TECH_BY_ID[id]?.minHabitability ?? min),
    BASE_MIN_HABITABILITY,
  );
}

export function canTerraform(state: GameState, factionId: FactionId): boolean {
  return state.factions[factionId].techs.some((id) => TECH_BY_ID[id]?.unlocksTerraform);
}
