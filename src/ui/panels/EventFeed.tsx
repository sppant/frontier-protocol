import { useMemo, useState } from 'react';
import { FACTIONS } from '@/domain/factions';
import { PERSONALITIES } from '@/bots/personalities';
import { fleetEta } from '@/sim/fleets';
import { useGameStore } from '@/store/gameStore';
import { useSelectionStore } from '@/store/selectionStore';
import { Panel, Tabs } from '@/ui/primitives';
import styles from './EventFeed.module.css';

const MAX_SHOWN = 30;

type FeedTab = 'events' | 'rivals';

export function EventFeed() {
  const game = useGameStore((s) => s.game);
  const select = useSelectionStore((s) => s.select);
  const player = game.playerFaction;
  const [tab, setTab] = useState<FeedTab>('events');

  const events = useMemo(
    () =>
      game.events
        .filter((e) => e.factionId === player)
        .slice(-MAX_SHOWN)
        .reverse(),
    [game.events, player],
  );
  const rivalMoves = useMemo(
    () =>
      Object.values(game.bots)
        .flatMap((b) => b?.log ?? [])
        .sort((a, b) => b.tick - a.tick)
        .slice(0, MAX_SHOWN),
    [game.bots],
  );
  const fleets = Object.values(game.fleets).filter((f) => f.ownerId === player);

  return (
    <Panel title="Event feed">
      <Tabs
        label="Feed"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'events', label: 'Events' },
          { id: 'rivals', label: 'Rival activity' },
        ]}
      />
      {tab === 'events' && fleets.length > 0 && (
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
      {tab === 'rivals' ? (
        rivalMoves.length === 0 ? (
          <p className={styles.empty}>Rival factions have not made any moves yet.</p>
        ) : (
          <ol className={styles.list} aria-label="Rival activity">
            {rivalMoves.map((m, i) => (
              <li key={`${m.factionId}-${m.tick}-${i}`}>
                <span className={`mono ${styles.day}`}>D{m.tick}</span>
                <span>
                  <strong style={{ color: FACTIONS[m.factionId].color }}>
                    {FACTIONS[m.factionId].name}
                  </strong>{' '}
                  ({PERSONALITIES[game.bots[m.factionId]?.personality ?? 'pioneer'].name}):{' '}
                  {m.label}
                  <span className={styles.why}> — {m.reason}</span>
                </span>
              </li>
            ))}
          </ol>
        )
      ) : events.length === 0 ? (
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
