import { FACTIONS } from '@/domain/factions';
import { EXPLORATION_LABEL, PLANET_COLORS, displayName } from '@/render/visuals';
import { useGalaxyStore } from '@/store/galaxyStore';
import { Panel } from '@/ui/primitives';
import styles from './SystemInspector.module.css';

export function SystemInspector() {
  const galaxy = useGalaxyStore((s) => s.galaxy);
  const states = useGalaxyStore((s) => s.systemStates);
  const selectedId = useGalaxyStore((s) => s.selectedId);

  const system = galaxy.systems.find((s) => s.id === selectedId);
  const state = system ? states[system.id] : undefined;

  if (!system || !state) {
    return (
      <Panel title="Inspector">
        <p className={styles.hint}>Select a star system on the map to inspect it.</p>
      </Panel>
    );
  }

  const explored = state.exploration === 'explored';
  const owner = state.ownerId ? FACTIONS[state.ownerId] : null;
  const planets = galaxy.planets.filter((p) => p.systemId === system.id);
  const neighbours = galaxy.lanes
    .filter(([a, b]) => a === system.id || b === system.id)
    .map(([a, b]) => (a === system.id ? b : a));

  return (
    <Panel title="Inspector">
      <h3 className={styles.name}>{displayName(system.name, state.exploration)}</h3>
      <dl className={styles.facts}>
        <dt>Status</dt>
        <dd>{EXPLORATION_LABEL[state.exploration]}</dd>
        <dt>Controller</dt>
        <dd>
          {state.exploration === 'unknown' ? (
            '—'
          ) : owner ? (
            <span style={{ color: owner.color }}>{owner.name}</span>
          ) : (
            'Unclaimed'
          )}
        </dd>
        <dt>Star</dt>
        <dd>{explored ? `${system.starClass} dwarf` : 'Unresolved'}</dd>
        <dt>Hyperlanes</dt>
        <dd className="mono">{neighbours.length}</dd>
      </dl>
      {explored ? (
        <>
          {system.hasAnomaly && (
            <p className={styles.anomaly}>◈ Ancient Nexus structure detected</p>
          )}
          <h4 className="label">Planets ({planets.length})</h4>
          <ul className={styles.planets}>
            {planets.map((p) => (
              <li key={p.id}>
                <i style={{ background: PLANET_COLORS[p.type] }} />
                <span>{p.name}</span>
                <span className={styles.dim}>{p.type}</span>
                <span className={`mono ${styles.dim}`} title="Habitability / minerals">
                  H{p.habitability} M{p.minerals}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.hint}>
          {state.exploration === 'detected'
            ? 'Long-range sensors detect a star here. Send an expedition to survey it.'
            : 'No data. This system is beyond sensor range.'}
        </p>
      )}
    </Panel>
  );
}
