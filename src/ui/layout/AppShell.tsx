import { GalaxyMap } from '@/render/GalaxyMap';
import { SystemInspector } from '@/ui/panels/SystemInspector';
import { Panel } from '@/ui/primitives';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <TopBar />
      <main className={styles.main}>
        <section className={styles.map} aria-label="Galaxy map">
          <GalaxyMap />
        </section>
        <aside className={styles.side}>
          <SystemInspector />
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
