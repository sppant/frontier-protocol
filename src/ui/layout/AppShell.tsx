import { GalaxyMap } from '@/render/GalaxyMap';
import { EventFeed } from '@/ui/panels/EventFeed';
import { Onboarding } from '@/ui/screens/Onboarding';
import { SettingsDialog } from '@/ui/screens/SettingsDialog';
import { useViewStore } from '@/store/viewStore';
import { Dialogs } from '@/ui/panels/Dialogs';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

export function AppShell() {
  const settingsOpen = useViewStore((s) => s.settingsOpen);
  return (
    <div className={styles.shell}>
      <TopBar />
      <main className={styles.main}>
        <section className={styles.map} aria-label="Galaxy map">
          <GalaxyMap />
          <Onboarding />
        </section>
        <aside className={styles.side}>
          <SidePanel />
        </aside>
        <div className={styles.feed}>
          <EventFeed />
        </div>
      </main>
      <Dialogs />
      {settingsOpen && <SettingsDialog />}
    </div>
  );
}
