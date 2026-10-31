import { Button, StatusDot } from '@/ui/primitives';
import { SPEEDS, useClockStore } from '@/store/clockStore';
import styles from './TopBar.module.css';

export function TopBar() {
  const paused = useClockStore((s) => s.paused);
  const speed = useClockStore((s) => s.speed);
  const togglePause = useClockStore((s) => s.togglePause);
  const setSpeed = useClockStore((s) => s.setSpeed);

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.title}>FRONTIER PROTOCOL</span>
        <span className="label">2479 · Nexus Survey</span>
      </div>
      <div className={styles.clock} role="group" aria-label="Simulation controls">
        <StatusDot status={paused ? 'warn' : 'ok'} label={paused ? 'Paused' : 'Running'} />
        <span className="label" data-testid="sim-status">
          {paused ? 'Paused' : 'Running'}
        </span>
        <Button onClick={togglePause} variant="primary" aria-label={paused ? 'Resume' : 'Pause'}>
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
