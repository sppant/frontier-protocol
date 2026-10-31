import { useEffect } from 'react';
import { useSelectionStore } from '@/store/selectionStore';
import { useViewStore } from '@/store/viewStore';
import { ObjectivesPanel } from '@/ui/panels/ObjectivesPanel';
import { ResearchPanel } from '@/ui/panels/ResearchPanel';
import { SystemInspector } from '@/ui/panels/SystemInspector';
import { Tabs } from '@/ui/primitives';
import styles from './SidePanel.module.css';

const TABS = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'research', label: 'Research' },
  { id: 'objectives', label: 'Objectives' },
] as const;

export function SidePanel() {
  const tab = useViewStore((s) => s.sideTab);
  const setTab = useViewStore((s) => s.setSideTab);
  const selectedId = useSelectionStore((s) => s.selectedId);

  // Picking something on the map always brings the inspector forward.
  useEffect(() => {
    if (selectedId) setTab('inspector');
  }, [selectedId, setTab]);

  return (
    <div className={styles.side}>
      <Tabs label="Side panel" tabs={[...TABS]} active={tab} onChange={setTab} />
      {tab === 'inspector' && <SystemInspector />}
      {tab === 'research' && <ResearchPanel />}
      {tab === 'objectives' && <ObjectivesPanel />}
    </div>
  );
}
