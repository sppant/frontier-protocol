import { useState } from 'react';
import { TECHS, type TechDef } from '@/domain/techs';
import { checkResearch } from '@/sim/research';
import { useGameStore } from '@/store/gameStore';
import { Button, Panel } from '@/ui/primitives';
import styles from './ResearchPanel.module.css';

export function ResearchPanel() {
  const game = useGameStore((s) => s.game);
  const research = useGameStore((s) => s.research);
  const [error, setError] = useState<string | null>(null);
  const player = game.playerFaction;
  const owned = game.factions[player].techs;
  const stock = Math.floor(game.factions[player].resources.research);

  const visible = TECHS.filter((t) => !t.faction || t.faction === player);
  const rows = [...visible].sort(
    (a, b) => Number(owned.includes(a.id)) - Number(owned.includes(b.id)) || a.cost - b.cost,
  );

  const row = (t: TechDef) => {
    const done = owned.includes(t.id);
    const check = checkResearch(game, player, t.id);
    return (
      <li key={t.id} className={`${styles.tech} ${done ? styles.done : ''}`}>
        <div className={styles.head}>
          <strong>{t.name}</strong>
          {t.faction && <span className={styles.unique}>unique</span>}
          {t.capstone && <span className={styles.unique}>victory</span>}
          <span className={`mono ${styles.cost}`}>{done ? '✓' : `${t.cost}⚗`}</span>
        </div>
        <p className={styles.desc}>{t.description}</p>
        {!done && (
          <div className={styles.foot}>
            <Button
              disabled={!check.ok}
              title={check.ok ? 'Begin applying this technology' : check.reason}
              onClick={() => {
                const r = research(t.id);
                setError(r.ok ? null : r.reason);
              }}
            >
              Research
            </Button>
            {!check.ok && <span className={styles.reason}>{check.reason}</span>}
          </div>
        )}
      </li>
    );
  };

  return (
    <Panel title="Research" actions={<span className="mono">{stock}⚗ available</span>}>
      {error && <p className={styles.error}>{error}</p>}
      <ul className={styles.list}>{rows.map(row)}</ul>
    </Panel>
  );
}
