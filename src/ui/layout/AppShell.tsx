import { GalaxyMap } from '@/render/GalaxyMap';
import { EventFeed } from '@/ui/panels/EventFeed';
import { SystemInspector } from '@/ui/panels/SystemInspector';
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
          <EventFeed />
        </div>
      </main>
    </div>
  );
}
