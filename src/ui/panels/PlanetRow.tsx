import { useState } from 'react';
import {
  BUILDINGS,
  BUILDING_IDS,
  MAX_BUILDING_LEVEL,
  MAX_TERRAFORM,
  TERRAFORM_STEP,
} from '@/domain/buildings';
import type { Colony, Resources } from '@/domain/game';
import type { Planet } from '@/domain/types';
import { PLANET_COLORS } from '@/render/visuals';
import { checkBuild, checkColonize, checkTerraform, checkUpgrade } from '@/sim/commands';
import { buildingLevel, colonyCapacity, colonyReport, effectiveHabitability } from '@/sim/economy';
import { modifiersFor } from '@/sim/modifiers';
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

type Outcome = { ok: boolean; reason?: string };

/** Everything the player can do with one of their own colonies. */
function ColonyActions({
  colony,
  planet,
  onResult,
}: {
  colony: Colony;
  planet: Planet;
  onResult: (r: Outcome) => void;
}) {
  const game = useGameStore((s) => s.game);
  const build = useGameStore((s) => s.build);
  const upgrade = useGameStore((s) => s.upgrade);
  const terraform = useGameStore((s) => s.terraform);
  const player = game.playerFaction;
  const report = colonyReport(colony, planet, modifiersFor(game, colony.ownerId));
  const unbuilt = BUILDING_IDS.filter(
    (b) =>
      !colony.buildings.includes(b) &&
      !colony.queue.some((q) => q.kind === 'build' && q.building === b),
  );
  const terraCheck = checkTerraform(game, player, colony.id);

  return (
    <>
      <span className={`mono ${styles.dim}`}>
        {`+${report.production.credits.toFixed(1)}¢ +${report.production.minerals.toFixed(1)}⛏ +${report.production.research.toFixed(1)}⚗ −${report.upkeep.toFixed(1)}¢`}
      </span>
      {colony.buildings.length > 0 && (
        <span className={styles.dim}>
          Built:{' '}
          {colony.buildings
            .map((b) => `${BUILDINGS[b].name} Lv${buildingLevel(colony, b)}`)
            .join(', ')}
        </span>
      )}
      {colony.queue.map((q, i) => (
        <span key={`${q.kind}-${i}`} className={styles.dim}>
          {q.kind === 'build' && `Building ${BUILDINGS[q.building].name}`}
          {q.kind === 'upgrade' && `Upgrading ${BUILDINGS[q.building].name}`}
          {q.kind === 'terraform' && 'Terraforming'} — {q.remaining}d left
        </span>
      ))}
      <div className={styles.actions}>
        {unbuilt.map((b) => {
          const check = checkBuild(game, player, colony.id, b);
          return (
            <Button
              key={b}
              disabled={!check.ok}
              title={check.ok ? BUILDINGS[b].description : check.reason}
              onClick={() => onResult(build(colony.id, b))}
            >
              {BUILDINGS[b].name} · {costText(BUILDINGS[b].cost)}
            </Button>
          );
        })}
        {colony.buildings
          .filter((b) => buildingLevel(colony, b) < MAX_BUILDING_LEVEL)
          .map((b) => {
            const check = checkUpgrade(game, player, colony.id, b);
            return (
              <Button
                key={`up-${b}`}
                disabled={!check.ok}
                title={check.ok ? `+50% output, higher upkeep` : check.reason}
                onClick={() => onResult(upgrade(colony.id, b))}
              >
                Upgrade {BUILDINGS[b].name} → Lv{buildingLevel(colony, b) + 1}
                {check.ok ? ` · ${costText(check.cost)}` : ''}
              </Button>
            );
          })}
        {colony.terraform < MAX_TERRAFORM && (
          <Button
            disabled={!terraCheck.ok}
            title={
              terraCheck.ok
                ? `+${TERRAFORM_STEP} habitability, raises the population cap`
                : terraCheck.reason
            }
            onClick={() => onResult(terraform(colony.id))}
          >
            Terraform +{TERRAFORM_STEP}
            {terraCheck.ok ? ` · ${costText(terraCheck.cost)}` : ''}
          </Button>
        )}
      </div>
    </>
  );
}

export function PlanetRow({ planet }: { planet: Planet }) {
  const game = useGameStore((s) => s.game);
  const colonize = useGameStore((s) => s.colonize);
  const [error, setError] = useState<string | null>(null);

  const player = game.playerFaction;
  const colony = game.colonies[colonyIdFor(planet.id)];
  const report = (r: Outcome) => setError(r.ok ? null : (r.reason ?? 'Failed.'));
  const habitability = effectiveHabitability(planet, colony?.terraform ?? 0);

  return (
    <li className={styles.planet}>
      <div className={styles.planetHead}>
        <i style={{ background: PLANET_COLORS[planet.type] }} />
        <span>{planet.name}</span>
        <span className={styles.dim}>{planet.type}</span>
        <span className={`mono ${styles.dim}`} title="Habitability / minerals">
          H{habitability} M{planet.minerals}
        </span>
      </div>
      {colony ? (
        <div className={styles.colony}>
          <span className={colony.ownerId === player ? styles.mine : styles.dim}>
            Colony · pop {Math.floor(colony.population)}/{colonyCapacity(planet, colony.terraform)}
          </span>
          {colony.ownerId === player && (
            <ColonyActions colony={colony} planet={planet} onResult={report} />
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
              {!check.ok && <span className={styles.reason}>{check.reason}</span>}
            </div>
          );
        })()
      )}
      {error && <span className={styles.error}>{error}</span>}
    </li>
  );
}
