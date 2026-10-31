import { FACTIONS } from '@/domain/factions';
import { useAppStore } from '@/store/appStore';
import { continueGame, discardSave } from '@/store/session';
import { Button } from '@/ui/primitives';
import styles from './Screens.module.css';

export function MainMenu() {
  const summary = useAppStore((s) => s.summary);
  const loadError = useAppStore((s) => s.loadError);
  const persistent = useAppStore((s) => s.persistent);
  const setScreen = useAppStore((s) => s.setScreen);

  return (
    <main className={styles.screen}>
      <div className={styles.hero}>
        <h1 className={styles.logo}>FRONTIER PROTOCOL</h1>
        <p className="label">2479 · The Nexus Survey</p>
        <p className={styles.blurb}>
          An ancient network of structures has been found across the stars. Four civilizations race
          to explore it, claim it and understand it. Lead one of them.
        </p>
      </div>

      <div className={styles.menu}>
        {summary && (
          <Button
            variant="primary"
            className={styles.big}
            onClick={() => void continueGame()}
            aria-label="Continue"
          >
            <span>Continue</span>
            <small>
              {FACTIONS[summary.faction].name} · Day {summary.day} ·{' '}
              {new Date(summary.savedAt).toLocaleString()}
            </small>
          </Button>
        )}
        <Button
          variant={summary ? 'default' : 'primary'}
          className={styles.big}
          onClick={() => setScreen('setup')}
        >
          <span>New game</span>
        </Button>
      </div>

      {loadError && (
        <div className={styles.notice} role="alert">
          <strong>Your saved game could not be loaded.</strong>
          <span>{loadError}</span>
          <Button onClick={() => void discardSave()}>Discard broken save</Button>
        </div>
      )}
      {!persistent && (
        <p className={styles.warn} role="status">
          Local storage is unavailable in this browser, so progress will not be saved.
        </p>
      )}
    </main>
  );
}
