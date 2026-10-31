import type { BuildingId, TechId } from './game';
import type { FactionId } from './types';

export type Personality = 'pioneer' | 'merchant' | 'warlord' | 'oracle';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Objective = 'ascendancy' | 'dominion';

export type BotAction =
  | { kind: 'expedition'; targetId: string }
  | { kind: 'colonize'; planetId: string }
  | { kind: 'build'; colonyId: string; building: BuildingId }
  | { kind: 'research'; techId: TechId };

/** One executed decision, with enough context to explain it. */
export interface DecisionEntry {
  tick: number;
  factionId: FactionId;
  action: BotAction;
  label: string;
  utility: number;
  /** Strongest scoring factors, e.g. "habitability +0.45, claim +0.35". */
  reason: string;
  /** Best runner-up candidates that were not chosen. */
  alternatives: { label: string; utility: number }[];
  objective: Objective | null;
}

export interface BotState {
  personality: Personality;
  difficulty: Difficulty;
  /** Private PRNG state (separate from the event RNG). */
  rngState: number;
  nextDecisionTick: number;
  objective: Objective | null;
  log: DecisionEntry[];
}

export type BotMap = Partial<Record<FactionId, BotState>>;
