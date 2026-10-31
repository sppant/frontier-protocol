import { Panel } from '@/ui/primitives';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <TopBar />
      <main className={styles.main}>
        <section className={styles.map} aria-label="Galaxy map">
          <p className="label">Galaxy map — not yet available</p>
        </section>
        <aside className={styles.side}>
          <Panel title="Inspector">
            <p>Select a star system to inspect it. Galaxy map arrives in the next milestone.</p>
          </Panel>
        </aside>
        <div className={styles.feed}>
          <Panel title="Event feed">
            <p>No events yet.</p>
          </Panel>
        </div>
      </main>
    </div>
  );
}
