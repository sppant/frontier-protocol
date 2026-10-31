import { useState } from 'react';
import { checkExpedition, EXPEDITION_COST } from '@/sim/fleets';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/ui/primitives';
import styles from './SystemInspector.module.css';

/** Launch a scout expedition toward a detected-but-unsurveyed system. */
export function ExpeditionAction({ systemId }: { systemId: string }) {
  const game = useGameStore((s) => s.game);
  const launch = useGameStore((s) => s.expedition);
  const [error, setError] = useState<string | null>(null);
  const check = checkExpedition(game, game.playerFaction, systemId);

  return (
    <div className={styles.actions} style={{ paddingLeft: 0 }}>
      <Button
        variant="primary"
        disabled={!check.ok}
        title={check.ok ? 'Send a scout to survey this system' : check.reason}
        onClick={() => {
          const r = launch(systemId);
          setError(r.ok ? null : r.reason);
        }}
      >
        Send expedition · {EXPEDITION_COST.credits}¢{check.ok ? ` · ${check.plan.eta}d` : ''}
      </Button>
      {!check.ok && <span className={styles.reason}>{check.reason}</span>}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
