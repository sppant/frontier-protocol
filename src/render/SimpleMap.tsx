import { useMemo } from 'react';
import { FACTIONS } from '@/domain/factions';
import { useGameStore } from '@/store/gameStore';
import { fleetPosition, fleetRoute } from '@/sim/fleets';
import { useExploration } from '@/store/selectors';
import { useSelectionStore } from '@/store/selectionStore';
import { STAR_COLORS, STAR_SIZES, UNKNOWN_COLOR, displayName, statusScale } from './visuals';
import styles from './SimpleMap.module.css';

/** Lightweight 2D top-down map. Used when WebGL is unavailable or the player chooses simple mode. */
export function SimpleMap() {
  const statusOf = useExploration();
  const galaxy = useGameStore((s) => s.game.galaxy);
  const states = useGameStore((s) => s.game.systemStates);
  const player = useGameStore((s) => s.game.playerFaction);
  const fleets = useGameStore((s) => s.game.fleets);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const select = useSelectionStore((s) => s.select);

  const byId = useMemo(() => new Map(galaxy.systems.map((s) => [s.id, s])), [galaxy]);
  const extent = useMemo(
    () =>
      Math.max(
        ...galaxy.systems.flatMap((s) => [Math.abs(s.position[0]), Math.abs(s.position[2])]),
      ) + 4,
    [galaxy],
  );

  return (
    <svg
      className={styles.svg}
      viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`}
      role="group"
      aria-label="Simple galaxy map"
      onClick={() => select(null)}
    >
      {galaxy.lanes.map(([a, b]) => {
        const pa = byId.get(a)?.position;
        const pb = byId.get(b)?.position;
        if (!pa || !pb) return null;
        const known = statusOf(a) !== 'unknown' || statusOf(b) !== 'unknown';
        return (
          <line
            key={`${a}-${b}`}
            x1={pa[0]}
            y1={pa[2]}
            x2={pb[0]}
            y2={pb[2]}
            className={known ? styles.lane : styles.laneDim}
          />
        );
      })}
      {Object.values(fleets)
        .filter((f) => f.ownerId === player)
        .map((f) => {
          const route = fleetRoute(galaxy, f);
          const [x, , z] = fleetPosition(galaxy, f);
          return (
            <g key={f.id} className={styles.fleet} aria-label="Expedition fleet" role="img">
              <polyline
                points={route.map((p) => `${p[0]},${p[2]}`).join(' ')}
                className={styles.route}
              />
              <path d={`M${x},${z - 1.1} L${x + 0.8},${z} L${x},${z + 1.1} L${x - 0.8},${z} Z`} />
            </g>
          );
        })}
      {galaxy.systems.map((sys) => {
        const st = states[sys.id];
        if (!st) return null;
        const status = statusOf(sys.id);
        const owner = st.ownerId ? FACTIONS[st.ownerId].color : null;
        const r = 0.9 * STAR_SIZES[sys.starClass] * statusScale(status);
        const color = status === 'unknown' ? UNKNOWN_COLOR : STAR_COLORS[sys.starClass];
        const selected = selectedId === sys.id;
        return (
          <g
            key={sys.id}
            className={styles.system}
            tabIndex={0}
            role="button"
            aria-label={`${displayName(sys.name, status)}${selected ? ' (selected)' : ''}`}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              select(sys.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select(sys.id);
              }
            }}
          >
            {owner && status !== 'unknown' && (
              <circle
                cx={sys.position[0]}
                cy={sys.position[2]}
                r={r + 1.6}
                fill="none"
                stroke={owner}
                strokeWidth={0.25}
                opacity={0.8}
              />
            )}
            {selected && (
              <circle
                cx={sys.position[0]}
                cy={sys.position[2]}
                r={r + 2.6}
                className={styles.selection}
              />
            )}
            <circle cx={sys.position[0]} cy={sys.position[2]} r={Math.max(r, 0.5)} fill={color} />
            {/* Larger invisible hit target */}
            <circle cx={sys.position[0]} cy={sys.position[2]} r={2.2} fill="transparent" />
            {status !== 'unknown' && (
              <text x={sys.position[0]} y={sys.position[2] + r + 2.2} className={styles.label}>
                {sys.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
