import { BUILDINGS, MAX_TERRAFORM, TERRAFORM_STEP } from '@/domain/buildings';
import { FACTION_IDS } from '@/domain/factions';
import type { Colony, FactionState, GameState } from '@/domain/game';
import type { FactionId } from '@/domain/types';
import { maybeTriggerEvent } from './events';
import { advanceFleets } from './fleets';
import { modifiersFor } from './modifiers';
import { checkVictory, recordHistory } from './victory';
import { factionReport, growPopulation, planetOf } from './economy';
import { withEvent } from './state';

function advanceFaction(state: GameState, id: FactionId): FactionState {
  const faction = state.factions[id];
  const { net } = factionReport(state, id);
  const credits = faction.resources.credits + net.credits;
  return {
    ...faction,
    deficit: credits < 0,
    resources: {
      credits: Math.max(0, credits),
      minerals: faction.resources.minerals + net.minerals,
      research: faction.resources.research + net.research,
    },
  };
}

/**
 * Advance the simulation by exactly one tick (one game day).
 * Order: income/upkeep from start-of-tick state → construction → population growth → tick++ → fleet movement → events → victory check.
 */
export function tick(state: GameState): GameState {
  if (state.victory) return state; // match is over
  const factions = { ...state.factions };
  for (const id of FACTION_IDS) factions[id] = advanceFaction(state, id);

  const growth = Object.fromEntries(FACTION_IDS.map((id) => [id, modifiersFor(state, id).growth]));
  const colonies: Record<string, Colony> = {};
  const completed: { colony: Colony; message: (planetName: string) => string }[] = [];
  for (const colony of Object.values(state.colonies)) {
    const planet = planetOf(state, colony.planetId);
    let next = colony;
    if (colony.queue.length > 0) {
      const [head, ...rest] = colony.queue;
      const remaining = (head?.remaining ?? 0) - 1;
      if (head && remaining <= 0) {
        if (head.kind === 'build') {
          next = { ...next, buildings: [...next.buildings, head.building], queue: rest };
          const name = BUILDINGS[head.building].name;
          completed.push({ colony: next, message: (p) => `${name} completed on ${p}.` });
        } else if (head.kind === 'upgrade') {
          const upgrades = {
            ...next.upgrades,
            [head.building]: (next.upgrades[head.building] ?? 0) + 1,
          };
          next = { ...next, upgrades, queue: rest };
          const name = BUILDINGS[head.building].name;
          const level = 1 + (upgrades[head.building] ?? 0);
          completed.push({
            colony: next,
            message: (p) => `${name} upgraded to level ${level} on ${p}.`,
          });
        } else {
          next = {
            ...next,
            terraform: Math.min(MAX_TERRAFORM, next.terraform + TERRAFORM_STEP),
            queue: rest,
          };
          completed.push({ colony: next, message: (p) => `Terraforming of ${p} advanced.` });
        }
      } else if (head) {
        next = { ...next, queue: [{ ...head, remaining }, ...rest] };
      }
    }
    if (planet) {
      const population = growPopulation(next, planet, growth[next.ownerId] ?? 1);
      if (population !== next.population) next = { ...next, population };
    }
    colonies[colony.id] = next;
  }

  let next: GameState = advanceFleets({ ...state, factions, colonies, tick: state.tick + 1 });
  for (const { colony, message } of completed) {
    const planet = planetOf(next, colony.planetId);
    next = withEvent(
      next,
      'construction',
      colony.ownerId,
      message(planet?.name ?? colony.planetId),
    );
  }
  for (const id of FACTION_IDS) {
    if (factions[id].deficit && !state.factions[id].deficit) {
      next = withEvent(next, 'economy', id, 'Credit deficit: upkeep exceeds available credits.');
    }
  }
  next = recordHistory(maybeTriggerEvent(next));
  const victory = checkVictory(next);
  if (victory) {
    next = withEvent(
      { ...next, victory, pendingEvent: null },
      'victory',
      victory.winner,
      `Victory: ${victory.kind}.`,
    );
  }
  return next;
}

export function advance(state: GameState, ticks: number): GameState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = tick(s);
  return s;
}
