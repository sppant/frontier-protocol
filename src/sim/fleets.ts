import { FACTIONS } from '@/domain/factions';
import type { Fleet, GameState, Resources } from '@/domain/game';
import { explorationOf, type FactionId, type Galaxy, type Vec3 } from '@/domain/types';
import type { Check, CommandResult } from './commands';
import { withEvent } from './state';

/** World units a fleet travels per tick. */
export const FLEET_SPEED = 3;
export const EXPEDITION_COST: Resources = { credits: 40, minerals: 0, research: 0 };
/** Research awarded for surveying an Ancient Nexus structure. */
export const ANOMALY_RESEARCH_REWARD = 25;

function position(galaxy: Galaxy, id: string): Vec3 {
  const s = galaxy.systems.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown system ${id}`);
  return s.position;
}

export function laneLength(galaxy: Galaxy, a: string, b: string): number {
  const pa = position(galaxy, a);
  const pb = position(galaxy, b);
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

export function travelTicks(galaxy: Galaxy, a: string, b: string): number {
  return Math.max(1, Math.ceil(laneLength(galaxy, a, b) / FLEET_SPEED));
}

/** Shortest path along hyperlanes (by distance), inclusive of both ends; null if unreachable. */
export function findPath(galaxy: Galaxy, from: string, to: string): string[] | null {
  const adj = new Map<string, string[]>();
  for (const [a, b] of galaxy.lanes) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const open = new Set<string>([from]);
  while (open.size > 0) {
    let cur = '';
    let best = Infinity;
    for (const id of open) {
      const d = dist.get(id) ?? Infinity;
      // Ties break on id so results never depend on set ordering.
      if (d < best || (d === best && id < cur)) {
        best = d;
        cur = id;
      }
    }
    open.delete(cur);
    if (cur === to) break;
    for (const n of adj.get(cur) ?? []) {
      const nd = best + laneLength(galaxy, cur, n);
      if (nd < (dist.get(n) ?? Infinity)) {
        dist.set(n, nd);
        prev.set(n, cur);
        open.add(n);
      }
    }
  }
  if (!dist.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0] as string) as string);
  return path;
}

export interface ExpeditionPlan {
  originId: string;
  path: string[];
  /** Total ticks to arrive. */
  eta: number;
  cost: Resources;
}

function planExpedition(
  state: GameState,
  factionId: FactionId,
  targetId: string,
): ExpeditionPlan | null {
  let best: { path: string[]; len: number } | null = null;
  for (const s of state.galaxy.systems) {
    if (state.systemStates[s.id]?.ownerId !== factionId) continue;
    const path = findPath(state.galaxy, s.id, targetId);
    if (!path) continue;
    const len = path
      .slice(1)
      .reduce((sum, id, i) => sum + laneLength(state.galaxy, path[i] as string, id), 0);
    if (!best || len < best.len) best = { path, len };
  }
  if (!best) return null;
  const eta = best.path
    .slice(1)
    .reduce((sum, id, i) => sum + travelTicks(state.galaxy, best.path[i] as string, id), 0);
  return { originId: best.path[0] as string, path: best.path, eta, cost: EXPEDITION_COST };
}

export function checkExpedition(
  state: GameState,
  factionId: FactionId,
  targetId: string,
): Check<{ plan: ExpeditionPlan }> {
  const status = explorationOf(state.systemStates[targetId], factionId);
  if (!state.systemStates[targetId]) return { ok: false, reason: 'Unknown system.' };
  if (status === 'explored') return { ok: false, reason: 'System already surveyed.' };
  if (status === 'unknown') return { ok: false, reason: 'Target is beyond sensor range.' };
  if (Object.values(state.fleets).some((f) => f.ownerId === factionId && f.targetId === targetId)) {
    return { ok: false, reason: 'An expedition is already en route.' };
  }
  const plan = planExpedition(state, factionId, targetId);
  if (!plan) return { ok: false, reason: 'No route from your territory.' };
  if (state.factions[factionId].resources.credits < plan.cost.credits) {
    return { ok: false, reason: 'Insufficient resources.' };
  }
  return { ok: true, plan };
}

export function launchExpedition(
  state: GameState,
  factionId: FactionId,
  targetId: string,
): CommandResult {
  const check = checkExpedition(state, factionId, targetId);
  if (!check.ok) return check;
  const { path, cost } = check.plan;
  const id = `fleet-${state.nextFleetId}`;
  const f = state.factions[factionId];
  const fleet: Fleet = {
    id,
    ownerId: factionId,
    kind: 'scout',
    fromId: path[0] as string,
    toId: path[1] as string,
    remainingPath: path.slice(2),
    progress: 0,
    legTicks: travelTicks(state.galaxy, path[0] as string, path[1] as string),
    targetId,
  };
  const next: GameState = {
    ...state,
    nextFleetId: state.nextFleetId + 1,
    fleets: { ...state.fleets, [id]: fleet },
    factions: {
      ...state.factions,
      [factionId]: {
        ...f,
        resources: { ...f.resources, credits: f.resources.credits - cost.credits },
      },
    },
  };
  const target = state.galaxy.systems.find((s) => s.id === targetId);
  return {
    ok: true,
    state: withEvent(
      next,
      'exploration',
      factionId,
      `Expedition launched toward ${target?.name ?? targetId}.`,
    ),
  };
}

/** Ticks until a fleet reaches its target. */
export function fleetEta(galaxy: Galaxy, fleet: Fleet): number {
  let eta = fleet.legTicks - fleet.progress;
  let from = fleet.toId;
  for (const next of fleet.remainingPath) {
    eta += travelTicks(galaxy, from, next);
    from = next;
  }
  return eta;
}

/** Current world position of a fleet, interpolated along its leg. */
export function fleetPosition(galaxy: Galaxy, fleet: Fleet): Vec3 {
  const a = position(galaxy, fleet.fromId);
  const b = position(galaxy, fleet.toId);
  const t = Math.min(1, fleet.progress / fleet.legTicks);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Polyline from the fleet's current position through the rest of its route. */
export function fleetRoute(galaxy: Galaxy, fleet: Fleet): Vec3[] {
  return [
    fleetPosition(galaxy, fleet),
    position(galaxy, fleet.toId),
    ...fleet.remainingPath.map((id) => position(galaxy, id)),
  ];
}

function surveyed(state: GameState, fleet: Fleet): GameState {
  const f = fleet.ownerId;
  const system = state.galaxy.systems.find((s) => s.id === fleet.targetId);
  if (!system) return state;
  const states = { ...state.systemStates };
  const target = states[system.id];
  if (target)
    states[system.id] = { ...target, exploration: { ...target.exploration, [f]: 'explored' } };
  for (const [a, b] of state.galaxy.lanes) {
    const other = a === system.id ? b : b === system.id ? a : null;
    const st = other ? states[other] : undefined;
    if (other && st && st.exploration[f] === 'unknown') {
      states[other] = { ...st, exploration: { ...st.exploration, [f]: 'detected' } };
    }
  }
  let next: GameState = { ...state, systemStates: states };
  const count = system.planetIds.length;
  next = withEvent(
    next,
    'exploration',
    f,
    `${FACTIONS[f].name} surveyed ${system.name}: ${count} planet${count === 1 ? '' : 's'} found.`,
  );
  if (system.hasAnomaly) {
    const fs = next.factions[f];
    next = {
      ...next,
      factions: {
        ...next.factions,
        [f]: {
          ...fs,
          resources: { ...fs.resources, research: fs.resources.research + ANOMALY_RESEARCH_REWARD },
        },
      },
    };
    next = withEvent(
      next,
      'discovery',
      f,
      `Ancient Nexus structure discovered in ${system.name}! +${ANOMALY_RESEARCH_REWARD} research.`,
    );
  }
  return next;
}

/** Move every fleet one tick; resolve arrivals. */
export function advanceFleets(state: GameState): GameState {
  const ids = Object.keys(state.fleets);
  if (ids.length === 0) return state;
  let next = state;
  const fleets: Record<string, Fleet> = {};
  for (const id of ids) {
    const fleet = {
      ...(state.fleets[id] as Fleet),
      progress: (state.fleets[id] as Fleet).progress + 1,
    };
    if (fleet.progress < fleet.legTicks) {
      fleets[id] = fleet;
      continue;
    }
    const [hop, ...rest] = fleet.remainingPath;
    if (hop === undefined) {
      next = surveyed(next, fleet);
      continue; // fleet consumed
    }
    fleets[id] = {
      ...fleet,
      fromId: fleet.toId,
      toId: hop,
      remainingPath: rest,
      progress: 0,
      legTicks: travelTicks(state.galaxy, fleet.toId, hop),
    };
  }
  return { ...next, fleets };
}
