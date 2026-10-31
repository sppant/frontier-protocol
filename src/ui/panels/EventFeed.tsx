import { useMemo } from 'react';
import { fleetEta } from '@/sim/fleets';
import { useGameStore } from '@/store/gameStore';
import { useSelectionStore } from '@/store/selectionStore';
import { Panel } from '@/ui/primitives';
import styles from './EventFeed.module.css';

const MAX_SHOWN = 30;

export function EventFeed() {
  const game = useGameStore((s) => s.game);
  const select = useSelectionStore((s) => s.select);
  const player = game.playerFaction;

  const events = useMemo(
    () =>
      game.events
        .filter((e) => e.factionId === player)
        .slice(-MAX_SHOWN)
        .reverse(),
    [game.events, player],
  );
  const fleets = Object.values(game.fleets).filter((f) => f.ownerId === player);

  return (
    <Panel title="Event feed">
      {fleets.length > 0 && (
        <ul className={styles.fleets} aria-label="Active expeditions">
          {fleets.map((f) => (
            <li key={f.id}>
              <button className={styles.link} onClick={() => select(f.targetId)}>
                ➤ Expedition →{' '}
                {game.galaxy.systems.find((s) => s.id === f.targetId)?.name ?? f.targetId}
              </button>
              <span className="mono">{fleetEta(game.galaxy, f)}d</span>
            </li>
          ))}
        </ul>
      )}
      {events.length === 0 ? (
        <p className={styles.empty}>No events yet. Send an expedition or build up your capital.</p>
      ) : (
        <ol className={styles.list}>
          {events.map((e) => (
            <li key={e.id} className={styles[e.kind]}>
              <span className={`mono ${styles.day}`}>D{e.tick}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
