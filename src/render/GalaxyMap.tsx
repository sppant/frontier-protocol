import { Component, Suspense, lazy, useMemo, type ReactNode } from 'react';
import { FACTIONS } from '@/domain/factions';
import { useViewStore } from '@/store/viewStore';
import { Button } from '@/ui/primitives';
import { SimpleMap } from './SimpleMap';
import { hasWebGL } from './webgl';
import styles from './GalaxyMap.module.css';

const GalaxyScene = lazy(() => import('./GalaxyScene'));

class SceneBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function GalaxyMap() {
  const mode = useViewStore((s) => s.renderMode);
  const setMode = useViewStore((s) => s.setRenderMode);
  const webgl = useMemo(() => hasWebGL(), []);
  const use3d = webgl && mode === '3d';

  return (
    <div className={styles.wrap}>
      {use3d ? (
        <SceneBoundary fallback={<SimpleMap />}>
          <Suspense
            fallback={<p className={`label ${styles.loading}`}>Initializing star charts…</p>}
          >
            <GalaxyScene />
          </Suspense>
        </SceneBoundary>
      ) : (
        <SimpleMap />
      )}
      <div className={styles.legend} aria-label="Map legend">
        {Object.values(FACTIONS).map((f) => (
          <span key={f.id} className={styles.legendItem}>
            <i style={{ background: f.color }} />
            {f.name}
          </span>
        ))}
      </div>
      {webgl && (
        <Button
          className={styles.modeToggle}
          active={mode === 'simple'}
          onClick={() => setMode(mode === 'simple' ? '3d' : 'simple')}
          title="Switch to a lightweight 2D map"
        >
          Simple map
        </Button>
      )}
    </div>
  );
}
