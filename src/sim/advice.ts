import { BUILDINGS, BUILDING_IDS } from '@/domain/buildings';
import type { GameState } from '@/domain/game';
import { TECHS } from '@/domain/techs';
import { explorationOf, type FactionId } from '@/domain/types';
import { checkBuild, checkColonize, checkTerraform, checkUpgrade } from './commands';
import { colonyCapacity, factionColonies, factionReport, planetOf } from './economy';
import { BASE_MIN_HABITABILITY, canTerraform, minHabitabilityFor } from './modifiers';
import { checkResearch } from './research';

const MAX_STEPS = 5;

/**
 * Plain-language hints about what a faction can do right now. Derived purely from
 * state, so the player is never left wondering "what can I do?".
 */
export function nextSteps(state: GameState, factionId: FactionId): string[] {
  const steps: string[] = [];
  const colonies = factionColonies(state, factionId);
  const res = state.factions[factionId].resources;
  const net = factionReport(state, factionId).net;
  const name = (planetId: string) => planetOf(state, planetId)?.name ?? planetId;

  // 1. Minerals only come from mines.
  if (net.minerals <= 0) {
    const target = colonies.find((c) => checkBuild(state, factionId, c.id, 'mine').ok);
    steps.push(
      target
        ? `Build a Mining Complex on ${name(target.planetId)}: minerals only come from mines.`
        : 'You have no mineral income. Gather credits and minerals for a Mining Complex.',
    );
  }

  // 2. Expansion options.
  const colonizable = state.galaxy.planets.filter((p) => {
    const c = checkColonize(state, factionId, p.id);
    return c.ok || c.reason === 'Insufficient resources.';
  });
  if (colonizable.length > 0) {
    const best = [...colonizable].sort((a, b) => b.habitability - a.habitability)[0];
    steps.push(
      `${colonizable.length} planet${colonizable.length === 1 ? '' : 's'} can be colonized, for example ${best?.name}. Select its system in the Inspector.`,
    );
  } else {
    const minHab = minHabitabilityFor(state, factionId);
    const poor = state.galaxy.planets.filter(
      (p) =>
        p.habitability < minHab &&
        p.habitability >= 5 &&
        !state.colonies[`col-${p.id}`] &&
        explorationOf(state.systemStates[p.systemId], factionId) === 'explored' &&
        [null, factionId].includes(state.systemStates[p.systemId]?.ownerId ?? null),
    );
    if (minHab === BASE_MIN_HABITABILITY && poor.length > 0) {
      steps.push(
        `No good planets left to settle. Research Hostile-Environment Habitats to claim ${poor.length} poor planet${poor.length === 1 ? '' : 's'} as outposts.`,
      );
    }
    const detected = state.galaxy.systems.filter(
      (s) => explorationOf(state.systemStates[s.id], factionId) === 'detected',
    );
    if (detected.length > 0) {
      steps.push(
        `${detected.length} detected system${detected.length === 1 ? '' : 's'} not yet surveyed. Send expeditions to find more planets.`,
      );
    }
  }

  // 3. Make existing colonies better.
  for (const colony of colonies) {
    const free = BUILDING_IDS.find((b) => checkBuild(state, factionId, colony.id, b).ok);
    if (free) {
      steps.push(`Build a ${BUILDINGS[free].name} on ${name(colony.planetId)}.`);
      break;
    }
  }
  for (const colony of colonies) {
    const up = colony.buildings.find((b) => checkUpgrade(state, factionId, colony.id, b).ok);
    if (up) {
      steps.push(`Upgrade the ${BUILDINGS[up].name} on ${name(colony.planetId)} for +50% output.`);
      break;
    }
  }

  // 4. Population ceiling.
  const capped = colonies.filter((c) => {
    const p = planetOf(state, c.planetId);
    return p && c.population >= colonyCapacity(p, c.terraform) - 0.5;
  });
  if (canTerraform(state, factionId)) {
    const t = colonies.find((c) => checkTerraform(state, factionId, c.id).ok);
    if (t)
      steps.push(`Terraform ${name(t.planetId)} to raise its habitability and population cap.`);
  } else if (capped.length > 0) {
    steps.push(
      `${capped.length} colon${capped.length === 1 ? 'y is' : 'ies are'} at the population cap. Research Terraforming to raise it.`,
    );
  }

  // 5. Spend research.
  const affordable = TECHS.filter((t) => checkResearch(state, factionId, t.id).ok);
  if (affordable.length > 0) {
    steps.push(
      `You can research: ${affordable
        .slice(0, 2)
        .map((t) => t.name)
        .join(', ')}.`,
    );
  }

  // 6. Resource hoarding.
  if (steps.length === 0 && (res.credits > 500 || res.minerals > 500)) {
    steps.push(
      'Resources are piling up with nothing to spend them on. Look for planets to settle or techs to unlock.',
    );
  }
  return steps.slice(0, MAX_STEPS);
}
