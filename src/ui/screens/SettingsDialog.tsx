import { useAppStore } from '@/store/appStore';
import { quitToMenu, saveNow } from '@/store/session';
import { useViewStore } from '@/store/viewStore';
import { Button, Dialog } from '@/ui/primitives';
import styles from './SettingsDialog.module.css';

const STATUS_TEXT = {
  idle: 'Not saved yet',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed. Your browser may be blocking storage.',
} as const;

export function SettingsDialog() {
  const close = () => useViewStore.getState().setSettingsOpen(false);
  const mode = useViewStore((s) => s.renderMode);
  const setMode = useViewStore((s) => s.setRenderMode);
  const setTutorial = useViewStore((s) => s.setTutorialStep);
  const status = useAppStore((s) => s.saveStatus);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const persistent = useAppStore((s) => s.persistent);

  return (
    <Dialog title="Settings" onClose={close}>
      <div className={styles.rows}>
        <div className={styles.row}>
          <span>Map rendering</span>
          <div className={styles.group} role="group" aria-label="Map rendering">
            <Button active={mode === '3d'} onClick={() => setMode('3d')}>
              3D
            </Button>
            <Button active={mode === 'simple'} onClick={() => setMode('simple')}>
              Simple 2D
            </Button>
          </div>
        </div>

        <div className={styles.row}>
          <span>
            Game saves automatically
            <small className={styles.sub} role="status">
              {persistent ? STATUS_TEXT[status] : 'Storage unavailable: progress will not be kept.'}
              {status === 'saved' && lastSavedAt
                ? ` at ${new Date(lastSavedAt).toLocaleTimeString()}`
                : ''}
            </small>
          </span>
          <Button onClick={() => void saveNow()}>Save now</Button>
        </div>

        <div className={styles.row}>
          <span>Tutorial</span>
          <Button
            onClick={() => {
              close();
              setTutorial(0);
            }}
          >
            Show again
          </Button>
        </div>

        <div className={styles.row}>
          <span>Leave this match (it is saved first)</span>
          <Button
            onClick={() => {
              close();
              void quitToMenu();
            }}
          >
            Main menu
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
