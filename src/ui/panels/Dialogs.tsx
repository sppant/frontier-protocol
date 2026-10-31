import { useState } from 'react';
import { FACTIONS } from '@/domain/factions';
import { EVENTS_BY_ID } from '@/domain/events';
import { checkEventChoice } from '@/sim/events';
import { useGameStore } from '@/store/gameStore';
import { quitToMenu, startNewGame } from '@/store/session';
import { Button, Dialog } from '@/ui/primitives';
import styles from './Dialogs.module.css';

const VICTORY_TEXT = {
  ascendancy: 'attuned to the Nexus and unlocked what the ancients left behind.',
  dominion: 'claimed enough of the frontier to dictate its future.',
  score: 'held the strongest position when the Convergence deadline passed.',
} as const;

function EventDialog() {
  const game = useGameStore((s) => s.game);
  const resolve = useGameStore((s) => s.resolveEvent);
  const [error, setError] = useState<string | null>(null);
  const def = game.pendingEvent ? EVENTS_BY_ID[game.pendingEvent.eventId] : undefined;
  if (!def) return null;

  return (
    <Dialog title={def.title}>
      <p className={styles.text}>{def.text}</p>
      <div className={styles.choices}>
        {def.choices.map((c) => {
          const check = checkEventChoice(game, c.id);
          return (
            <Button
              key={c.id}
              className={styles.choice}
              disabled={!check.ok}
              title={check.ok ? undefined : check.reason}
              onClick={() => {
                const r = resolve(c.id);
                setError(r.ok ? null : r.reason);
              }}
            >
              <strong>{c.label}</strong>
              <span>{check.ok ? c.description : `${c.description} — ${check.reason}`}</span>
            </Button>
          );
        })}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </Dialog>
  );
}

function VictoryDialog() {
  const game = useGameStore((s) => s.game);
  const victory = game.victory;
  if (!victory) return null;
  const winner = FACTIONS[victory.winner];
  const won = victory.winner === game.playerFaction;
  const difficulty = Object.values(game.bots)[0]?.difficulty ?? 'normal';

  return (
    <Dialog title={won ? 'Victory' : 'Defeat'}>
      <p className={styles.text}>
        <strong style={{ color: winner.color }}>{winner.name}</strong> {VICTORY_TEXT[victory.kind]}
      </p>
      <p className={styles.text}>
        {won
          ? `Your faction prevailed on day ${victory.tick}.`
          : `The match ended on day ${victory.tick}. Another faction reached its goal first.`}
      </p>
      <div className={styles.endActions}>
        <Button
          variant="primary"
          onClick={() =>
            void startNewGame({ seed: game.seed + 1, faction: game.playerFaction, difficulty })
          }
        >
          Play again (new galaxy)
        </Button>
        <Button onClick={() => void quitToMenu()}>Main menu</Button>
      </div>
    </Dialog>
  );
}

export function Dialogs() {
  return (
    <>
      <EventDialog />
      <VictoryDialog />
    </>
  );
}
