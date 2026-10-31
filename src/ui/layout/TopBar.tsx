import { useMemo } from 'react';
import { FACTIONS } from '@/domain/factions';
import { RESOURCE_IDS, type ResourceId } from '@/domain/game';
import { factionReport } from '@/sim/economy';
import { SPEEDS, useClockStore } from '@/store/clockStore';
import { useGameStore } from '@/store/gameStore';
import { Button, StatusDot } from '@/ui/primitives';
import styles from './TopBar.module.css';

const RESOURCE_LABEL: Record<ResourceId, string> = {
  credits: 'Credits',
  minerals: 'Minerals',
  research: 'Research',
};

function formatRate(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
}

function ResourceBar() {
  const game = useGameStore((s) => s.game);
  const resources = game.factions[game.playerFaction].resources;
  const net = useMemo(() => factionReport(game, game.playerFaction).net, [game]);
  return (
    <ul className={styles.resources} aria-label="Resources">
      {RESOURCE_IDS.map((id) => (
        <li
          key={id}
          className={styles.resource}
          style={{ ['--res' as string]: `var(--res-${id})` }}
          title={`${RESOURCE_LABEL[id]}: ${formatRate(net[id])} per day`}
        >
          <span className="label">{RESOURCE_LABEL[id]}</span>
          <span className="mono" data-testid={`res-${id}`}>
            {Math.floor(resources[id])}
          </span>
          <span className={`mono ${net[id] < 0 ? styles.neg : styles.rate}`}>
            {formatRate(net[id])}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TopBar() {
  const faction = FACTIONS[useGameStore((s) => s.game.playerFaction)];
  const day = useGameStore((s) => s.game.tick);
  const blocked = useGameStore((s) => !!(s.game.pendingEvent || s.game.victory));
  const clockPaused = useClockStore((s) => s.paused);
  const paused = clockPaused || blocked;
  const speed = useClockStore((s) => s.speed);
  const togglePause = useClockStore((s) => s.togglePause);
  const setSpeed = useClockStore((s) => s.setSpeed);

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.title}>FRONTIER PROTOCOL</span>
        <span className="label">
          2479 · <span style={{ color: faction.color }}>{faction.name}</span>
        </span>
      </div>
      <ResourceBar />
      <div className={styles.clock} role="group" aria-label="Simulation controls">
        <span className="label mono" data-testid="game-day">
          Day {day}
        </span>
        <StatusDot status={paused ? 'warn' : 'ok'} label={paused ? 'Paused' : 'Running'} />
        <span className="label" data-testid="sim-status">
          {paused ? 'Paused' : 'Running'}
        </span>
        <Button
          onClick={togglePause}
          variant="primary"
          disabled={blocked}
          title={blocked ? 'A decision is waiting' : undefined}
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          {paused ? '▶ Resume' : '❚❚ Pause'}
        </Button>
        {SPEEDS.map((s) => (
          <Button
            key={s}
            active={speed === s}
            onClick={() => setSpeed(s)}
            aria-label={`Speed ${s}x`}
          >
            {s}×
          </Button>
        ))}
      </div>
    </header>
  );
}
