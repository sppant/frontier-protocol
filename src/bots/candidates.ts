import { BUILDINGS, BUILDING_IDS } from '@/domain/buildings';
import type { BotAction, Objective } from '@/domain/bots';
import type { GameState, Resources } from '@/domain/game';
import { TECHS } from '@/domain/techs';
import { explorationOf, type FactionId } from '@/domain/types';
import { checkBuild, checkColonize } from '@/sim/commands';
import { colonyCapacity, factionReport, planetOf } from '@/sim/economy';
import { checkExpedition } from '@/sim/fleets';
import { checkResearch } from '@/sim/research';
import type { Weights } from './personalities';

export interface Candidate {
  /** Stable identity for deterministic tie-breaking. */
  key: string;
  action: BotAction;
  label: string;
  utility: number;
  /** Named contributions to the utility, for explanations. */
  breakdown: Record<string, number>;
}

export interface Context {
  factionId: FactionId;
  weights: Weights;
  objective: Objective | null;
  /** Credits to keep after spending. */
  reserve: number;
  /** Technologies on the path to the capstone. */
  capstoneChain: Set<string>;
}

/** Bots run at most this many scouts at once. */
const MAX_ACTIVE_EXPEDITIONS = 2;
/** Minerals a bot keeps back to be able to build its first mine. */
const MINE_RESERVE = BUILDINGS.mine.cost.minerals;

const sum = (b: Record<string, number>) => Object.values(b).reduce((a, v) => a + v, 0);

function neighbours(state: GameState, systemId: string): string[] {
  const out: string[] = [];
  for (const [a, b] of state.galaxy.lanes) {
    if (a === systemId) out.push(b);
    else if (b === systemId) out.push(a);
  }
  return out;
}

function rivalNeighbours(state: GameState, systemId: string, me: FactionId): number {
  return neighbours(state, systemId).filter((n) => {
    const o = state.systemStates[n]?.ownerId;
    return !!o && o !== me;
  }).length;
}

function make(
  key: string,
  action: BotAction,
  label: string,
  breakdown: Record<string, number>,
): Candidate {
  return { key, action, label, breakdown, utility: sum(breakdown) };
}

function expeditions(state: GameState, ctx: Context, colonizableKnown: number): Candidate[] {
  const { factionId: f, weights: w } = ctx;
  const out: Candidate[] = [];
  // Exploring matters less once there are plenty of known targets.
  const saturation = colonizableKnown >= 3 ? 0.4 : 1;
  const active = Object.values(state.fleets).filter((fl) => fl.ownerId === f).length;
  if (active >= MAX_ACTIVE_EXPEDITIONS) return [];
  for (const sys of state.galaxy.systems) {
    if (explorationOf(state.systemStates[sys.id], f) !== 'detected') continue;
    const check = checkExpedition(state, f, sys.id);
    if (!check.ok) continue;
    if (state.factions[f].resources.credits - check.plan.cost.credits < ctx.reserve) continue;
    const unknownNeighbours = neighbours(state, sys.id).filter(
      (n) => explorationOf(state.systemStates[n], f) === 'unknown',
    ).length;
    out.push(
      make(`exp:${sys.id}`, { kind: 'expedition', targetId: sys.id }, `Expedition to ${sys.name}`, {
        exploration: w.explore * (0.45 + 0.12 * unknownNeighbours) * saturation,
        frontier: w.contest * 0.15 * Math.min(1, rivalNeighbours(state, sys.id, f)),
      }),
    );
  }
  return out;
}

function colonizations(state: GameState, ctx: Context, netReport: Resources): Candidate[] {
  const { factionId: f, weights: w } = ctx;
  if (netReport.credits < 0) return []; // don't expand into a deficit spiral
  // Minerals only come from mines: never spend the last of them before one exists.
  const needsMineMinerals = netReport.minerals <= 0;
  const out: Candidate[] = [];
  for (const planet of state.galaxy.planets) {
    const check = checkColonize(state, f, planet.id);
    if (!check.ok) continue;
    if (state.factions[f].resources.credits - check.cost.credits < ctx.reserve) continue;
    if (
      needsMineMinerals &&
      state.factions[f].resources.minerals - check.cost.minerals < MINE_RESERVE
    )
      continue;
    const owned = state.systemStates[planet.systemId]?.ownerId === f;
    const rivals = rivalNeighbours(state, planet.systemId, f);
    const sys = state.galaxy.systems.find((s) => s.id === planet.systemId);
    out.push(
      make(
        `col:${planet.id}`,
        { kind: 'colonize', planetId: planet.id },
        `Colonize ${planet.name}`,
        {
          habitability: w.expand * (planet.habitability / 100) * 0.5,
          resources:
            w.expand * (planet.minerals / 5) * 0.15 * w.minerals +
            w.expand * (planet.size / 3) * 0.1,
          claim: owned ? 0 : w.expand * 0.35,
          contested: owned || rivals === 0 ? 0 : w.contest * 0.3,
          safety: w.safety * (rivals === 0 ? 0.15 : -0.15 * rivals),
          anomaly: sys?.hasAnomaly ? w.research * 0.1 : 0,
        },
      ),
    );
  }
  return out;
}

function builds(
  state: GameState,
  ctx: Context,
  netCredits: number,
  netMinerals: number,
): Candidate[] {
  const { factionId: f, weights: w } = ctx;
  const res = state.factions[f].resources;
  const out: Candidate[] = [];
  for (const colony of Object.values(state.colonies)) {
    if (colony.ownerId !== f) continue;
    const planet = planetOf(state, colony.planetId);
    if (!planet) continue;
    const pop = Math.floor(colony.population);
    for (const b of BUILDING_IDS) {
      const check = checkBuild(state, f, colony.id, b);
      if (!check.ok) continue;
      if (res.credits - check.cost.credits < ctx.reserve) continue;
      // Anything with upkeep must be sustainable; trade hubs fix the problem.
      if (b !== 'tradeHub' && netCredits < 0.5) continue;
      if (b !== 'mine' && netMinerals <= 0 && res.minerals - check.cost.minerals < MINE_RESERVE)
        continue;
      const need = {
        mine: netMinerals <= 0 ? 2.5 : res.minerals < 120 ? 1.3 : 0.9,
        lab: 1,
        tradeHub: res.credits < 150 || netCredits < 2 ? 1.4 : 1,
      }[b];
      const base = {
        mine: w.economy * w.minerals * (0.2 + 0.1 * planet.minerals),
        lab: w.research * (0.2 + 0.03 * pop),
        tradeHub: w.economy * (0.2 + 0.04 * pop),
      }[b];
      out.push(
        make(
          `bld:${colony.id}:${b}`,
          { kind: 'build', colonyId: colony.id, building: b },
          `Build ${BUILDINGS[b].name} on ${planet.name}`,
          {
            output: base * need,
            capacity: 0.05 * (pop / colonyCapacity(planet)),
          },
        ),
      );
    }
  }
  return out;
}

function techUtility(ctx: Context, techId: string): Record<string, number> {
  const tech = TECHS.find((t) => t.id === techId);
  if (!tech) return {};
  const w = ctx.weights;
  const m = tech.mult ?? {};
  const raw: Record<string, number> = {
    income: ((m.credits ?? 1) - 1) * w.economy * 2,
    industry: ((m.minerals ?? 1) - 1) * w.economy * 1.5 * w.minerals,
    science: ((m.research ?? 1) - 1) * w.research * 2.5,
    colonies: (1 - (m.colonyCost ?? 1)) * w.expand * 1.5 + ((m.growth ?? 1) - 1) * w.expand,
    thrift: (1 - (m.upkeep ?? 1)) * w.economy * 1.5,
    scouting:
      ((m.fleetSpeed ?? 1) - 1) * w.explore * 0.8 + (tech.surveyReach ?? 0) * 0.25 * w.explore,
  };
  const efficiency = 80 / (tech.cost + 40);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) if (v > 0) out[k] = v * efficiency;
  if (tech.capstone) out.capstone = ctx.objective === 'ascendancy' ? 3 : 1.5;
  else if (ctx.objective === 'ascendancy' && ctx.capstoneChain.has(tech.id)) out.objective = 0.25;
  return out;
}

function researches(state: GameState, ctx: Context): Candidate[] {
  const out: Candidate[] = [];
  for (const tech of TECHS) {
    if (!checkResearch(state, ctx.factionId, tech.id).ok) continue;
    out.push(
      make(
        `tech:${tech.id}`,
        { kind: 'research', techId: tech.id },
        `Research ${tech.name}`,
        techUtility(ctx, tech.id),
      ),
    );
  }
  return out;
}

/** All currently legal actions for a faction, scored by personality-weighted utility. */
export function generateCandidates(state: GameState, ctx: Context): Candidate[] {
  const f = ctx.factionId;
  const net = factionReport(state, f).net;
  const netCredits = net.credits;
  const colonizations_ = colonizations(state, ctx, net);
  const knownTargets = new Set(
    colonizations_.map((c) => (c.action.kind === 'colonize' ? c.action.planetId : '')),
  );
  return [
    ...colonizations_,
    ...expeditions(state, ctx, knownTargets.size),
    ...builds(state, ctx, netCredits, net.minerals),
    ...researches(state, ctx),
  ];
}
