import { FACTIONS } from '@/domain/factions';
import { TECH_BY_ID } from '@/domain/techs';
import type { TechId } from '@/domain/game';
import type { GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import type { Check, CommandResult } from './commands';
import { ATTUNEMENT_DAYS } from './victory';
import { withEvent } from './state';

/** Why (or whether) a faction may research a technology right now. */
export function checkResearch(state: GameState, factionId: FactionId, techId: TechId): Check {
  const tech = TECH_BY_ID[techId];
  const f = state.factions[factionId];
  if (!tech) return { ok: false, reason: 'Unknown technology.' };
  if (f.techs.includes(techId)) return { ok: false, reason: 'Already researched.' };
  if (tech.faction && tech.faction !== factionId) {
    return { ok: false, reason: 'Unavailable to your faction.' };
  }
  const missing = tech.requires.filter((r) => !f.techs.includes(r));
  if (missing.length > 0) {
    const names = missing.map((m) => TECH_BY_ID[m]?.name ?? m).join(', ');
    return { ok: false, reason: `Requires ${names}.` };
  }
  if (tech.requiresStory !== undefined && state.storyStage < tech.requiresStory) {
    return { ok: false, reason: 'The Nexus has not yet awakened.' };
  }
  if (f.resources.research < tech.cost) {
    return { ok: false, reason: `Needs ${tech.cost} research.` };
  }
  return { ok: true };
}

export function researchTech(
  state: GameState,
  factionId: FactionId,
  techId: TechId,
): CommandResult {
  const check = checkResearch(state, factionId, techId);
  if (!check.ok) return check;
  const tech = TECH_BY_ID[techId];
  if (!tech) return { ok: false, reason: 'Unknown technology.' };
  const f = state.factions[factionId];
  const next: GameState = {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: {
        ...f,
        techs: [...f.techs, techId],
        attunementDone: tech.capstone ? state.tick + ATTUNEMENT_DAYS : f.attunementDone,
        resources: { ...f.resources, research: f.resources.research - tech.cost },
      },
    },
  };
  if (tech.capstone) {
    return {
      ok: true,
      state: withEvent(
        next,
        'victory',
        factionId,
        `${FACTIONS[factionId].name} has begun attuning to the Nexus. Ascendancy on day ${state.tick + ATTUNEMENT_DAYS}.`,
      ),
    };
  }
  return {
    ok: true,
    state: withEvent(next, 'research', factionId, `Research complete: ${tech.name}.`),
  };
}
