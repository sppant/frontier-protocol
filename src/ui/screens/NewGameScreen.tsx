import { useState } from 'react';
import type { Difficulty } from '@/domain/bots';
import { FACTION_IDS, FACTIONS, modifierHighlights } from '@/domain/factions';
import { TECHS } from '@/domain/techs';
import type { FactionId } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { startNewGame } from '@/store/session';
import { useViewStore } from '@/store/viewStore';
import { Button } from '@/ui/primitives';
import { hasSeenTutorial } from '@/ui/onboarding';
import styles from './Screens.module.css';

const DIFFICULTIES: { id: Difficulty; name: string; text: string }[] = [
  { id: 'easy', name: 'Easy', text: 'Rivals decide slowly and make occasional mistakes.' },
  { id: 'normal', name: 'Normal', text: 'Rivals plan toward a goal and react steadily.' },
  { id: 'hard', name: 'Hard', text: 'Rivals decide fast and plan well. Same resources as you.' },
];

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

export function NewGameScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const [faction, setFaction] = useState<FactionId>('terran');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [seed, setSeed] = useState(() => String(randomSeed()));
  const parsed = Number(seed);
  const seedOk = seed.trim() !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed < 2 ** 31;

  const start = () => {
    void startNewGame({ seed: parsed, faction, difficulty }).then(() => {
      useViewStore.getState().setSideTab('inspector');
      useViewStore.getState().setTutorialStep(hasSeenTutorial() ? null : 0);
    });
  };

  return (
    <main className={styles.screen}>
      <div className={styles.setup}>
        <h1 className={styles.heading}>New game</h1>

        <section aria-labelledby="faction-h">
          <h2 id="faction-h" className="label">
            Choose your faction
          </h2>
          <div role="radiogroup" aria-labelledby="faction-h" className={styles.cards}>
            {FACTION_IDS.map((id) => {
              const f = FACTIONS[id];
              const unique = TECHS.find((t) => t.faction === id);
              return (
                <button
                  key={id}
                  role="radio"
                  aria-checked={faction === id}
                  className={`${styles.card} ${faction === id ? styles.selected : ''}`}
                  style={{ ['--fc' as string]: f.color }}
                  onClick={() => setFaction(id)}
                >
                  <strong>{f.name}</strong>
                  <span className={styles.tagline}>{f.tagline}</span>
                  <ul>
                    {modifierHighlights(f.modifiers).map((h) => (
                      <li key={h.text} className={h.good ? styles.good : styles.bad}>
                        {h.text}
                      </li>
                    ))}
                  </ul>
                  {unique && <span className={styles.unique}>Unique tech: {unique.name}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="diff-h">
          <h2 id="diff-h" className="label">
            Rival difficulty
          </h2>
          <div role="radiogroup" aria-labelledby="diff-h" className={styles.diffs}>
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                role="radio"
                aria-checked={difficulty === d.id}
                className={`${styles.card} ${difficulty === d.id ? styles.selected : ''}`}
                onClick={() => setDifficulty(d.id)}
              >
                <strong>{d.name}</strong>
                <span className={styles.tagline}>{d.text}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.seedRow}>
          <label htmlFor="seed" className="label">
            Galaxy seed
          </label>
          <input
            id="seed"
            className={styles.input}
            inputMode="numeric"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            aria-invalid={!seedOk}
          />
          <Button onClick={() => setSeed(String(randomSeed()))}>Randomize</Button>
          {!seedOk && (
            <span className={styles.bad}>Enter a whole number from 0 to 2147483647.</span>
          )}
        </section>

        <div className={styles.actions}>
          <Button onClick={() => setScreen('menu')}>Back</Button>
          <Button variant="primary" disabled={!seedOk} onClick={start}>
            Begin as {FACTIONS[faction].name}
          </Button>
        </div>
      </div>
    </main>
  );
}
