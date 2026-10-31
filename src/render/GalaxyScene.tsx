import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { FACTIONS } from '@/domain/factions';
import { createRng } from '@/sim/rng';
import { useGameStore } from '@/store/gameStore';
import { useSelectionStore } from '@/store/selectionStore';
import { STAR_COLORS, STAR_SIZES, UNKNOWN_COLOR, displayName, statusScale } from './visuals';
import { prefersReducedMotion } from './webgl';
import styles from './GalaxyScene.module.css';

const BASE_RADIUS = 0.6;

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

function Stars() {
  const galaxy = useGameStore((s) => s.game.galaxy);
  const states = useGameStore((s) => s.game.systemStates);
  const select = useSelectionStore((s) => s.select);
  const hover = useSelectionStore((s) => s.hover);
  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    galaxy.systems.forEach((sys, i) => {
      const st = states[sys.id];
      const status = st?.exploration ?? 'unknown';
      dummy.position.set(...sys.position);
      dummy.scale.setScalar(STAR_SIZES[sys.starClass] * statusScale(status));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      color.set(status === 'unknown' ? UNKNOWN_COLOR : STAR_COLORS[sys.starClass]);
      m.setColorAt(i, color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [galaxy, states]);

  const idAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId === undefined ? null : (galaxy.systems[e.instanceId]?.id ?? null);

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, galaxy.systems.length]}
      onClick={(e) => {
        if (e.delta > 4) return; // was a camera drag
        e.stopPropagation();
        select(idAt(e));
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        hover(idAt(e));
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
        hover(null);
      }}
    >
      <sphereGeometry args={[BASE_RADIUS, 20, 14]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

function Glows() {
  const galaxy = useGameStore((s) => s.game.galaxy);
  const states = useGameStore((s) => s.game.systemStates);
  const texture = useMemo(() => makeGlowTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(galaxy.systems.length * 3);
    const colors = new Float32Array(galaxy.systems.length * 3);
    const c = new THREE.Color();
    galaxy.systems.forEach((sys, i) => {
      positions.set(sys.position, i * 3);
      const known = states[sys.id]?.exploration !== 'unknown';
      c.set(known ? STAR_COLORS[sys.starClass] : UNKNOWN_COLOR).multiplyScalar(known ? 1 : 0.3);
      colors.set([c.r, c.g, c.b], i * 3);
    });
    return { positions, colors };
  }, [galaxy, states]);

  return (
    <points>
      <bufferGeometry key={positions.length + String(Object.keys(states).length)}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={5}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Lanes() {
  const galaxy = useGameStore((s) => s.game.galaxy);
  const states = useGameStore((s) => s.game.systemStates);

  const { positions, colors } = useMemo(() => {
    const byId = new Map(galaxy.systems.map((s) => [s.id, s]));
    const pos: number[] = [];
    const col: number[] = [];
    const bright = new THREE.Color('#5d7898');
    const dim = new THREE.Color('#1f2a38');
    for (const [a, b] of galaxy.lanes) {
      const sa = byId.get(a);
      const sb = byId.get(b);
      if (!sa || !sb) continue;
      const known = states[a]?.exploration !== 'unknown' || states[b]?.exploration !== 'unknown';
      const c = known ? bright : dim;
      pos.push(...sa.position, ...sb.position);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    return { positions: new Float32Array(pos), colors: new Float32Array(col) };
  }, [galaxy, states]);

  return (
    <lineSegments key={`${positions.length}-${colors.join('').length}`}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.9} />
    </lineSegments>
  );
}

const ringGeometry = new THREE.RingGeometry(2.1, 2.4, 48);

function Territories() {
  const galaxy = useGameStore((s) => s.game.galaxy);
  const states = useGameStore((s) => s.game.systemStates);
  const materials = useMemo(
    () =>
      Object.fromEntries(
        Object.values(FACTIONS).map((f) => [
          f.id,
          new THREE.MeshBasicMaterial({
            color: f.color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        ]),
      ),
    [],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  return (
    <>
      {galaxy.systems.map((sys) => {
        const st = states[sys.id];
        if (!st?.ownerId || st.exploration === 'unknown') return null;
        const material = materials[st.ownerId];
        if (!material) return null;
        return (
          <mesh
            key={sys.id}
            geometry={ringGeometry}
            material={material}
            position={sys.position}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        );
      })}
    </>
  );
}

const selectionGeometry = new THREE.RingGeometry(1.7, 1.85, 32);
const selectionMaterial = new THREE.MeshBasicMaterial({
  color: '#ffb347',
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
});

function SelectionRing({ animate }: { animate: boolean }) {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const galaxy = useGameStore((s) => s.game.galaxy);
  const ref = useRef<THREE.Mesh>(null);
  const sys = galaxy.systems.find((s) => s.id === selectedId);

  useFrame(({ camera, clock }) => {
    const m = ref.current;
    if (!m) return;
    m.quaternion.copy(camera.quaternion);
    if (animate) m.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.06);
  });

  if (!sys) return null;
  return (
    <mesh
      ref={ref}
      geometry={selectionGeometry}
      material={selectionMaterial}
      position={sys.position}
    />
  );
}

function Labels() {
  const galaxy = useGameStore((s) => s.game.galaxy);
  const states = useGameStore((s) => s.game.systemStates);
  const hoveredId = useSelectionStore((s) => s.hoveredId);
  return (
    <>
      {galaxy.systems.map((sys) => {
        const status = states[sys.id]?.exploration ?? 'unknown';
        if (status === 'unknown' && hoveredId !== sys.id) return null;
        return (
          <Html
            key={sys.id}
            position={[sys.position[0], sys.position[1] - 1.6, sys.position[2]]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <span className={hoveredId === sys.id ? styles.labelHover : styles.label}>
              {displayName(sys.name, status)}
            </span>
          </Html>
        );
      })}
    </>
  );
}

function Backdrop({ seed }: { seed: number }) {
  const texture = useMemo(() => makeGlowTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const { stars, nebulae } = useMemo(() => {
    const rng = createRng(seed ^ 0x9e3779b9);
    const stars = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) {
      const r = rng.float(90, 140);
      const theta = rng.float(0, Math.PI * 2);
      const phi = Math.acos(rng.float(-1, 1));
      stars.set(
        [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta),
        ],
        i * 3,
      );
    }
    const palette = ['#3b5a8a', '#6a3b5a', '#2f6a66', '#5a4a2a'];
    const nebulae = palette.map((color, i) => ({
      color,
      position: [rng.float(-45, 45), rng.float(-14, -6), rng.float(-45, 45)] as [
        number,
        number,
        number,
      ],
      scale: rng.float(50, 80) + i,
    }));
    return { stars, nebulae };
  }, [seed]);

  return (
    <>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.5}
          color="#9fb2cc"
          sizeAttenuation
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </points>
      {nebulae.map((n, i) => (
        <sprite key={i} position={n.position} scale={[n.scale, n.scale, 1]}>
          <spriteMaterial
            map={texture}
            color={n.color}
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </>
  );
}

export default function GalaxyScene() {
  const seed = useGameStore((s) => s.game.galaxy.seed);
  const select = useSelectionStore((s) => s.select);
  const reduced = useMemo(() => prefersReducedMotion(), []);

  return (
    <Canvas
      camera={{ position: [0, 32, 28], fov: 45, near: 0.5, far: 400 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={(e) => {
        // Ignore the click that ends a camera drag.
        if ((e as MouseEvent).detail > 0) select(null);
      }}
      aria-label="Galaxy map"
    >
      <color attach="background" args={['#07090d']} />
      <Backdrop seed={seed} />
      <Lanes />
      <Territories />
      <Glows />
      <Stars />
      <SelectionRing animate={!reduced} />
      <Labels />
      <OrbitControls
        makeDefault
        enableDamping={!reduced}
        dampingFactor={0.1}
        minDistance={12}
        maxDistance={90}
        maxPolarAngle={Math.PI * 0.47}
        screenSpacePanning={false}
      />
    </Canvas>
  );
}
