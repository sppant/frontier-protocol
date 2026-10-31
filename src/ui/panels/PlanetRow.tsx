import { useState } from 'react';
import { BUILDINGS, BUILDING_IDS } from '@/domain/buildings';
import type { Resources } from '@/domain/game';
import type { Planet } from '@/domain/types';
import { PLANET_COLORS } from '@/render/visuals';
import { checkBuild, checkColonize } from '@/sim/commands';
import { colonyCapacity, colonyReport } from '@/sim/economy';
import { colonyIdFor } from '@/sim/state';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/ui/primitives';
import styles from './SystemInspector.module.css';

function costText(c: Resources): string {
  return [
    c.credits && `${c.credits}¢`,
    c.minerals && `${c.minerals}⛏`,
    c.research && `${c.research}⚗`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function PlanetRow({ planet }: { planet: Planet }) {
  const game = useGameStore((s) => s.game);
  const colonize = useGameStore((s) => s.colonize);
  const build = useGameStore((s) => s.build);
  const [error, setError] = useState<string | null>(null);

  const player = game.playerFaction;
  const colony = game.colonies[colonyIdFor(planet.id)];
  const report = (r: { ok: boolean; reason?: string }) =>
    setError(r.ok ? null : (r.reason ?? 'Failed.'));

  return (
    <li className={styles.planet}>
      <div className={styles.planetHead}>
        <i style={{ background: PLANET_COLORS[planet.type] }} />
        <span>{planet.name}</span>
        <span className={styles.dim}>{planet.type}</span>
        <span className={`mono ${styles.dim}`} title="Habitability / minerals">
          H{planet.habitability} M{planet.minerals}
        </span>
      </div>
      {colony ? (
        <div className={styles.colony}>
          <span className={colony.ownerId === player ? styles.mine : styles.dim}>
            Colony · pop {Math.floor(colony.population)}/{colonyCapacity(planet)}
          </span>
          {colony.ownerId === player && (
            <>
              <span className={`mono ${styles.dim}`}>
                {(() => {
                  const r = colonyReport(colony, planet);
                  return `+${r.production.credits.toFixed(1)}¢ +${r.production.minerals.toFixed(1)}⛏ +${r.production.research.toFixed(1)}⚗ −${r.upkeep.toFixed(1)}¢`;
                })()}
              </span>
              {colony.buildings.length > 0 && (
                <span className={styles.dim}>
                  Built: {colony.buildings.map((b) => BUILDINGS[b].name).join(', ')}
                </span>
              )}
              {colony.queue.map((q) => (
                <span key={q.building} className={styles.dim}>
                  Building {BUILDINGS[q.building].name} — {q.remaining}d left
                </span>
              ))}
              <div className={styles.actions}>
                {BUILDING_IDS.filter(
                  (b) =>
                    !colony.buildings.includes(b) && !colony.queue.some((q) => q.building === b),
                ).map((b) => {
                  const check = checkBuild(game, player, colony.id, b);
                  return (
                    <Button
                      key={b}
                      disabled={!check.ok}
                      title={check.ok ? BUILDINGS[b].description : check.reason}
                      onClick={() => report(build(colony.id, b))}
                    >
                      {BUILDINGS[b].name} · {costText(BUILDINGS[b].cost)}
                    </Button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        (() => {
          const check = checkColonize(game, player, planet.id);
          return (
            <div className={styles.actions}>
              <Button
                variant="primary"
                disabled={!check.ok}
                title={check.ok ? 'Establish a colony on this planet' : check.reason}
                onClick={() => report(colonize(planet.id))}
              >
                Colonize{check.ok ? ` · ${costText(check.cost)}` : ''}
              </Button>
              {!check.ok && <span className={styles.dim}>{check.reason}</span>}
            </div>
          );
        })()
      )}
      {error && <span className={styles.error}>{error}</span>}
    </li>
  );
}
