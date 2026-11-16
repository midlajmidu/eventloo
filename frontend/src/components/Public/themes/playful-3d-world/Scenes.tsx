/* Client-only WebGL scenes for the Playful 3D World theme. Imported lazily, never during SSR. */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, Float, Lightformer, RoundedBox, Text3D } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { Group } from "three";

const FONT = "/fonts/droid_sans_bold.typeface.json";
const C = { blue: "#2F5BFF", sky: "#7cc4ff", coral: "#FF6F61", orange: "#FF8A1F", lavender: "#B9A4FF", lime: "#B8F04A", cream: "#FFF3DA" };

function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Lights() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 5, 2]} scale={[10, 10, 1]} />
        <Lightformer intensity={1.2} color={C.lavender} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer intensity={1.2} color={C.orange} position={[5, 0, 1]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
      </Environment>
    </>
  );
}

function Shell({ children, className, label, camera = [0, 0, 8] as [number, number, number] }: { children: ReactNode; className: string; label: string; camera?: [number, number, number] }) {
  const [ref, on] = useOnScreen<HTMLDivElement>();
  const [ready, setReady] = useState(false);
  return (
    <div ref={ref} className={className} role="img" aria-label={label} data-scene-ready={ready || undefined}>
      <Canvas dpr={[1, typeof window !== "undefined" && window.innerWidth < 768 ? 1.25 : 1.75]} frameloop={on ? "always" : "never"}
        camera={{ position: camera, fov: 40 }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }} onCreated={() => setTimeout(() => setReady(true), 300)}>
        <Lights />
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}

function Balloon({ position, color, speed = 1 }: { position: [number, number, number]; color: string; speed?: number }) {
  return (
    <Float speed={speed * 1.5} rotationIntensity={0.4} floatIntensity={1.2}>
      <group position={position}>
        <mesh scale={[1, 1.18, 1]}><sphereGeometry args={[0.45, 32, 32]} /><meshStandardMaterial color={color} roughness={0.25} metalness={0.05} /></mesh>
        <mesh position={[0, -0.56, 0]}><coneGeometry args={[0.08, 0.12, 12]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[0, -1.1, 0]}><cylinderGeometry args={[0.008, 0.008, 1, 4]} /><meshStandardMaterial color="#ffffff" /></mesh>
      </group>
    </Float>
  );
}

function Star({ position, color }: { position: [number, number, number]; color: string }) {
  const g = useRef<Group>(null);
  useFrame((_, d) => { if (g.current && !reduced()) g.current.rotation.y += Math.min(d, 0.05) * 0.8; });
  return (
    <group ref={g} position={position}>
      <mesh><octahedronGeometry args={[0.28, 0]} /><meshStandardMaterial color={color} roughness={0.3} flatShading /></mesh>
    </group>
  );
}

/** Extruded title that sizes itself to the viewport, plus balloons; the camera eases with page scroll. */
function TitleScene({ title, year }: { title: string; year: string | null }) {
  const { viewport, camera } = useThree();
  const g = useRef<Group>(null);
  const size = Math.min(0.95, (viewport.width * 0.72) / Math.max(4, title.length * 0.78));
  useFrame((state, d) => {
    const dt = Math.min(d, 0.05);
    const s = Math.min(1, window.scrollY / 700);
    camera.position.y += (-s * 1.2 - camera.position.y) * (1 - Math.exp(-4 * dt));
    camera.position.x += (state.pointer.x * 0.4 - camera.position.x) * (1 - Math.exp(-3 * dt));
    camera.lookAt(0, -s * 0.4, 0);
    if (g.current && !reduced()) g.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.08;
  });
  const left = -viewport.width / 2;
  return (
    <>
      <group ref={g}>
        <Center position={[0, 0.35, 0]}>
          <Text3D font={FONT} size={size} height={size * 0.35} bevelEnabled bevelSize={size * 0.04} bevelThickness={size * 0.05} curveSegments={6} letterSpacing={0.02}>
            {title}
            <meshStandardMaterial color={C.cream} roughness={0.35} />
          </Text3D>
        </Center>
        {year && (
          <Float speed={2} floatIntensity={0.3} rotationIntensity={0.1}>
            <group position={[0, -size * 0.9, 0.2]}>
              <RoundedBox args={[1.9, 0.62, 0.3]} radius={0.12}><meshStandardMaterial color={C.orange} roughness={0.3} /></RoundedBox>
              <Center position={[0, 0, 0.17]}>
                <Text3D font={FONT} size={0.34} height={0.08} curveSegments={4}>{year}<meshStandardMaterial color="#ffffff" /></Text3D>
              </Center>
            </group>
          </Float>
        )}
      </group>
      <Balloon position={[left + 0.9, 1.4, -1]} color={C.coral} />
      <Balloon position={[left + 1.7, 0.6, -2]} color={C.lavender} speed={0.8} />
      <Balloon position={[-left - 1.1, 1.6, -1.5]} color={C.lime} speed={1.2} />
      <Star position={[left + 1.2, -1.6, 0]} color={C.orange} />
      <Star position={[-left - 1.4, -1.2, 0.5]} color={C.sky} />
      <Star position={[0.4, 2.2, -1]} color={C.lavender} />
    </>
  );
}

export function HeroScene({ title, year }: { title: string; year: string | null }) {
  return (
    <Shell className="absolute inset-0" label={`${title} in 3D letters with floating balloons`}>
      <TitleScene title={title} year={year} />
    </Shell>
  );
}

const blockColors = [C.orange, C.lavender, C.coral, C.blue];

function Block({ x, value, color, w }: { x: number; value: string; color: string; w: number }) {
  const g = useRef<Group>(null);
  useFrame((state) => {
    if (g.current && !reduced()) g.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.2 + x) * 0.12;
  });
  return (
    <group ref={g} position={[x, 0, 0]}>
      <RoundedBox args={[w, w * 0.95, w * 0.7]} radius={w * 0.14} smoothness={3}>
        <meshStandardMaterial color={color} roughness={0.35} />
      </RoundedBox>
      <Center position={[0, 0, w * 0.36]}>
        <Text3D font={FONT} size={w * 0.42} height={w * 0.12} bevelEnabled bevelSize={0.01} bevelThickness={0.02} curveSegments={4}>
          {value}
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </Text3D>
      </Center>
    </group>
  );
}

function Blocks({ values }: { values: string[] }) {
  const { viewport } = useThree();
  const gap = 0.25;
  const w = Math.min(2.4, (viewport.width - gap * 5) / 4);
  return (
    <group rotation={[-0.15, 0, 0]}>
      {values.map((v, i) => <Block key={i} x={(i - 1.5) * (w + gap)} value={v} color={blockColors[i]!} w={w} />)}
    </group>
  );
}

export function CountdownScene({ values, label }: { values: string[]; label: string }) {
  return (
    <Shell className="h-full w-full" label={label} camera={[0, 0.6, 7]}>
      <Blocks values={values} />
    </Shell>
  );
}
