import { Suspense, lazy } from 'react';
import { FACTIONS, FACTION_IDS } from '@/domain/factions';
import { CHAPTERS } from '@/domain/events';
import { score, systemsOwned, victoryProgress } from '@/sim/victory';
import { useGameStore } from '@/store/gameStore';
import { Panel } from '@/ui/primitives';
import styles from './ObjectivesPanel.module.css';

const ScoreChart = lazy(() => import('./ScoreChart'));

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export function ObjectivesPanel() {
  const game = useGameStore((s) => s.game);
  const player = game.playerFaction;
  const p = victoryProgress(game, player);
  const chapter = CHAPTERS[Math.min(Math.max(game.storyStage - 1, 0), CHAPTERS.length - 1)];
  const attuning = FACTION_IDS.flatMap((f) => {
    const done = game.factions[f].attunementDone;
    return done === null ? [] : [{ f, done }];
  });
  const standings = [...FACTION_IDS].sort((a, b) => score(game, b) - score(game, a));

  return (
    <Panel title="Objectives">
      <p className="label">
        Chapter {Math.max(game.storyStage, 1)} of {CHAPTERS.length}
      </p>
      <h3 className={styles.chapter}>{chapter}</h3>

      <h4 className="label">Paths to victory</h4>
      <ul className={styles.paths}>
        <li>
          <div className={styles.row}>
            <strong>Nexus Ascendancy</strong>
            <span className="mono">
              {p.ascendancy.techsDone}/{p.ascendancy.techsNeeded}
            </span>
          </div>
          <Bar
            label="Ascendancy progress"
            value={p.ascendancy.techsDone}
            max={p.ascendancy.techsNeeded}
          />
          <p className={styles.desc}>
            Research the chain to Nexus Attunement (unlocks at the Convergence), then hold on for
            the 100-day attunement.
          </p>
          {attuning.map(({ f, done }) => (
            <p key={f} className={styles.alert}>
              {FACTIONS[f].name} attuning — Ascendancy in {Math.max(0, done - game.tick)} days
            </p>
          ))}
        </li>
        <li>
          <div className={styles.row}>
            <strong>Dominion</strong>
            <span className="mono">
              {p.dominion.owned}/{p.dominion.needed} systems
            </span>
          </div>
          <Bar label="Dominion progress" value={p.dominion.owned} max={p.dominion.needed} />
          <p className={styles.desc}>
            Control {p.dominion.needed} systems by colonizing before rivals do.
          </p>
        </li>
        <li>
          <div className={styles.row}>
            <strong>Hegemony</strong>
            <span className="mono">{p.daysLeft}d left</span>
          </div>
          <p className={styles.desc}>
            If nobody wins sooner, the highest score on the final day prevails.
          </p>
        </li>
      </ul>

      <h4 className="label">Score over time</h4>
      <Suspense fallback={<p className={styles.desc}>Loading chart…</p>}>
        <ScoreChart />
      </Suspense>

      <h4 className="label">Standings</h4>
      <table className={styles.table} aria-label="Standings">
        <thead>
          <tr>
            <th>Faction</th>
            <th>Systems</th>
            <th>Techs</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((f) => (
            <tr key={f}>
              <td style={{ color: FACTIONS[f].color }}>
                {FACTIONS[f].name}
                {f === player ? ' (you)' : ''}
              </td>
              <td className="mono">{systemsOwned(game, f)}</td>
              <td className="mono">{game.factions[f].techs.length}</td>
              <td className="mono">{score(game, f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
