"use client";
/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js object properties. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei/core/ContactShadows.js";
import { OrbitControls } from "@react-three/drei/core/OrbitControls.js";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ProductUnit } from "@/lib/domain";

type CameraPreset = "overview" | "inspection" | "reject";

function CameraRig({ preset }: { preset: CameraPreset }) {
  const { camera } = useThree();
  useEffect(() => {
    const positions: Record<CameraPreset, [number, number, number]> = {
      overview: [9.5, 8, 11.5],
      inspection: [-2.6, 5.2, 7],
      reject: [6.5, 4.6, 6.5],
    };
    camera.position.set(...positions[preset]);
    camera.lookAt(preset === "inspection" ? -2.2 : preset === "reject" ? 4.4 : 0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, preset]);
  return null;
}

function Bottle({ product }: { product: ProductUnit }) {
  const ref = useRef<THREE.Group>(null);
  const isRejected = product.disposition === "REJECT" && product.position >= 78;
  const x = -7.2 + Math.min(product.position, 108) * 0.135;
  const branch = isRejected ? Math.min((product.position - 78) / 22, 1) : 0;
  const z = branch * 3.2;
  const labelColor = product.disposition === "REJECT" ? "#d95043" : product.stage === "accepted" ? "#4aa776" : product.stage === "barcode" ? "#c8f33d" : "#2d7b55";

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, x, 10, delta);
    ref.current.position.z = THREE.MathUtils.damp(ref.current.position.z, z, 10, delta);
    ref.current.rotation.z = THREE.MathUtils.damp(ref.current.rotation.z, isRejected ? -0.18 * branch : 0, 8, delta);
  });

  return (
    <group ref={ref} position={[x, .72, z]}>
      <mesh castShadow><cylinderGeometry args={[.24, .29, .85, 24]} /><meshStandardMaterial color="#f1efe4" roughness={.55} /></mesh>
      <mesh position={[0,.49,0]} castShadow><cylinderGeometry args={[.18,.2,.13,24]} /><meshStandardMaterial color="#d7ed80" roughness={.7} /></mesh>
      <mesh position={[0,.07,-.275]}><boxGeometry args={[.38,.31,.015]} /><meshStandardMaterial color={labelColor} emissive={labelColor} emissiveIntensity={.12} /></mesh>
      {product.stage === "vision" || product.stage === "barcode" ? <pointLight color="#c8f33d" intensity={1.7} distance={2.2} position={[0,1,0]} /> : null}
    </group>
  );
}

function StationFrame({ x, color = "#7f8a84", width = 1.25 }: { x:number; color?:string; width?:number }) {
  return (
    <group position={[x,0,0]}>
      <mesh position={[-width/2,.95,0]} castShadow><boxGeometry args={[.1,1.9,.12]} /><meshStandardMaterial color={color} metalness={.65} roughness={.3} /></mesh>
      <mesh position={[width/2,.95,0]} castShadow><boxGeometry args={[.1,1.9,.12]} /><meshStandardMaterial color={color} metalness={.65} roughness={.3} /></mesh>
      <mesh position={[0,1.86,0]} castShadow><boxGeometry args={[width+.1,.12,.14]} /><meshStandardMaterial color={color} metalness={.65} roughness={.3} /></mesh>
      <mesh position={[0,1.7,0]}><boxGeometry args={[.42,.16,.12]} /><meshStandardMaterial color="#172821" emissive="#c8f33d" emissiveIntensity={.28} /></mesh>
    </group>
  );
}

function Conveyor({ running }: { running:boolean }) {
  const rollers = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!running || !rollers.current) return;
    rollers.current.children.forEach((child) => { child.rotation.z -= delta * 2.4; });
  });
  return (
    <group>
      <mesh receiveShadow position={[0,.25,0]}><boxGeometry args={[15.5,.25,1.28]} /><meshStandardMaterial color="#3d4944" metalness={.45} roughness={.5} /></mesh>
      <group ref={rollers}>
        {Array.from({ length: 26 }, (_, i) => <mesh key={i} position={[-7.25+i*.58,.43,0]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.25,.25,1.14,16]} /><meshStandardMaterial color={i%2 ? "#7a8580" : "#68736e"} metalness={.7} roughness={.35} /></mesh>)}
      </group>
      {[-6.8,-3.4,0,3.4,6.8].map((x) => <group key={x} position={[x,0,0]}><mesh position={[0,-.35,-.48]}><boxGeometry args={[.14,1.2,.14]} /><meshStandardMaterial color="#5b6661" /></mesh><mesh position={[0,-.35,.48]}><boxGeometry args={[.14,1.2,.14]} /><meshStandardMaterial color="#5b6661" /></mesh></group>)}
    </group>
  );
}

function Factory({ products, running }: { products:ProductUnit[]; running:boolean }) {
  return (
    <>
      <color attach="background" args={["#12201a"]} />
      <fog attach="fog" args={["#12201a", 15, 28]} />
      <ambientLight intensity={1.1} />
      <directionalLight castShadow position={[-4,9,6]} intensity={2.2} color="#f3f0df" shadow-mapSize={[1024,1024]} />
      <pointLight position={[2,5,-3]} color="#c8f33d" intensity={7} distance={12} />
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.95,0]} receiveShadow><planeGeometry args={[28,18]} /><meshStandardMaterial color="#17261f" roughness={.9} /></mesh>
      <gridHelper args={[28,28,"#355346","#263b32"]} position={[0,-.93,0]} />
      <Conveyor running={running} />
      <StationFrame x={-5.55} color="#718079" width={.75} />
      <StationFrame x={-2.5} color="#c8f33d" />
      <StationFrame x={.75} color="#81908a" />
      <StationFrame x={4.25} color="#d69a39" width={1.5} />
      <group position={[4.25,.48,-1.1]}>
        <mesh castShadow><boxGeometry args={[.15,.15,1.45]} /><meshStandardMaterial color="#d69a39" metalness={.5} /></mesh>
        <mesh position={[0,0,-.78]} castShadow><boxGeometry args={[.85,.7,.12]} /><meshStandardMaterial color="#c64c3e" /></mesh>
      </group>
      <mesh position={[5.3,-.25,3.25]} castShadow><boxGeometry args={[2.0,1.35,1.75]} /><meshStandardMaterial color="#2d3833" metalness={.3} roughness={.65} /></mesh>
      <mesh position={[5.3,.45,3.25]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.7,1.45]} /><meshStandardMaterial color="#111b17" /></mesh>
      {products.map((product) => <Bottle key={product.id} product={product} />)}
      <ContactShadows position={[0,-.91,0]} opacity={.6} scale={22} blur={2.8} far={5} />
    </>
  );
}

export function FactoryScene({ products, running, cameraPreset }: { products:ProductUnit[]; running:boolean; cameraPreset:CameraPreset }) {
  return (
    <Canvas shadows dpr={[1,1.6]} camera={{ position:[9.5,8,11.5], fov:42, near:.1, far:80 }} gl={{ antialias:true, powerPreference:"high-performance" }}>
      <CameraRig preset={cameraPreset} />
      <Factory products={products} running={running} />
      <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={22} minPolarAngle={.55} maxPolarAngle={1.35} target={[0,.3,0]} />
    </Canvas>
  );
}
