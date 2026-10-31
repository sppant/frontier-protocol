import type { BotAction, BotState, DecisionEntry, Objective } from '@/domain/bots';
import { FACTION_IDS } from '@/domain/factions';
import type { GameState } from '@/domain/game';
import { TECHS } from '@/domain/techs';
import type { FactionId } from '@/domain/types';
import {
  colonize,
  startConstruction,
  startTerraform,
  startUpgrade,
  type CommandResult,
} from '@/sim/commands';
import { launchExpedition } from '@/sim/fleets';
import { researchTech } from '@/sim/research';
import { createRng } from '@/sim/rng';
import { victoryProgress } from '@/sim/victory';
import { generateCandidates, type Candidate, type Context } from './candidates';
import { DIFFICULTIES, MIN_UTILITY, PERSONALITIES, type Weights } from './personalities';

const MAX_LOG = 60;

function execute(state: GameState, f: FactionId, a: BotAction): CommandResult {
  switch (a.kind) {
    case 'colonize':
      return colonize(state, f, a.planetId);
    case 'expedition':
      return launchExpedition(state, f, a.targetId);
    case 'build':
      return startConstruction(state, f, a.colonyId, a.building);
    case 'upgrade':
      return startUpgrade(state, f, a.colonyId, a.building);
    case 'terraform':
      return startTerraform(state, f, a.colonyId);
    case 'research':
      return researchTech(state, f, a.techId);
  }
}

function capstoneChain(): Set<string> {
  const chain = new Set<string>();
  const visit = (id: string) => {
    if (chain.has(id)) return;
    chain.add(id);
    TECHS.find((t) => t.id === id)?.requires.forEach(visit);
  };
  const cap = TECHS.find((t) => t.capstone);
  if (cap) visit(cap.id);
  return chain;
}
const CHAIN = capstoneChain();

/** Pick a long-term goal: the personality's natural path, or whichever is further along for Merchants. */
export function chooseObjective(state: GameState, f: FactionId, bot: BotState): Objective | null {
  if (!DIFFICULTIES[bot.difficulty].planning) return null;
  if (bot.personality === 'oracle') return 'ascendancy';
  if (bot.personality === 'warlord' || bot.personality === 'pioneer') return 'dominion';
  const p = victoryProgress(state, f);
  return p.ascendancy.techsDone / p.ascendancy.techsNeeded > p.dominion.owned / p.dominion.needed
    ? 'ascendancy'
    : 'dominion';
}

function adjust(weights: Weights, objective: Objective | null): Weights {
  if (objective === 'dominion')
    return { ...weights, expand: weights.expand * 1.25, contest: weights.contest * 1.2 };
  if (objective === 'ascendancy') return { ...weights, research: weights.research * 1.3 };
  return weights;
}

function explain(c: Candidate): string {
  const top = Object.entries(c.breakdown)
    .filter(([, v]) => Math.abs(v) >= 0.01)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, 2)
    .map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v.toFixed(2)}`);
  return top.join(', ') || 'default';
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Run one decision round for a bot if it is due. Pure: returns a new state.
 * Bots act only through the same validated commands as the player.
 */
export function runBotDecision(state: GameState, factionId: FactionId): GameState {
  const bot = state.bots[factionId];
  if (!bot || state.tick < bot.nextDecisionTick || state.victory) return state;

  const cfg = DIFFICULTIES[bot.difficulty];
  const rng = createRng(bot.rngState);
  const objective = chooseObjective(state, factionId, bot);
  const ctx: Context = {
    factionId,
    weights: adjust(PERSONALITIES[bot.personality].weights, objective),
    objective,
    reserve: cfg.reserve,
    capstoneChain: CHAIN,
  };

  let next = state;
  const entries: DecisionEntry[] = [];
  for (let i = 0; i < cfg.actions; i++) {
    const scored = generateCandidates(next, ctx)
      .map((c) => ({
        c,
        u: c.utility * (1 + (cfg.noise > 0 ? rng.float(-cfg.noise, cfg.noise) : 0)),
      }))
      .sort((a, b) => b.u - a.u || (a.c.key < b.c.key ? -1 : 1));
    const best = scored[0];
    if (!best || best.u < MIN_UTILITY) break;
    const result = execute(next, factionId, best.c.action);
    if (!result.ok) break; // candidates are pre-validated; stop rather than loop on a stale view
    next = result.state;
    entries.push({
      tick: state.tick,
      factionId,
      action: best.c.action,
      label: best.c.label,
      utility: round(best.u),
      reason: explain(best.c),
      alternatives: scored.slice(1, 4).map((s) => ({ label: s.c.label, utility: round(s.u) })),
      objective,
    });
  }

  const updated: BotState = {
    ...bot,
    rngState: rng.state(),
    nextDecisionTick: state.tick + cfg.interval,
    objective,
    log: [...bot.log, ...entries].slice(-MAX_LOG),
  };
  return { ...next, bots: { ...next.bots, [factionId]: updated } };
}

/** Bots hold their turn while the player has a decision pending, so the player is never pre-empted. */
export function runBots(state: GameState): GameState {
  if (state.pendingEvent) return state;
  let s = state;
  for (const f of FACTION_IDS) s = runBotDecision(s, f);
  return s;
}
