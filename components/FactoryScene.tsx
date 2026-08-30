"use client";
/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js object properties. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei/core/ContactShadows.js";
import { OrbitControls } from "@react-three/drei/core/OrbitControls.js";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ProductUnit } from "@/lib/domain";

type CameraPreset = "overview" | "inspection" | "reject";
const SIGNAL = "#c8ff3d", STEEL = "#68756f", DARK = "#26332d", RED = "#ff5548", AMBER = "#f2a93b";
const clamp = (value:number) => THREE.MathUtils.clamp(value, 0, 1);
const smooth = (value:number) => value * value * (3 - 2 * value);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function CameraRig({preset}:{preset:CameraPreset}) {
  const {camera} = useThree();
  const remaining = useRef(0);
  const positions = useMemo<Record<CameraPreset,THREE.Vector3>>(() => ({
    overview:new THREE.Vector3(11.8,7.1,13.6), inspection:new THREE.Vector3(-.6,4.1,7.5), reject:new THREE.Vector3(8.1,4.2,7.8),
  }), []);
  const targets = useMemo<Record<CameraPreset,THREE.Vector3>>(() => ({
    overview:new THREE.Vector3(0,.55,.2), inspection:new THREE.Vector3(-1.05,1.05,0), reject:new THREE.Vector3(4.25,.58,1.65),
  }), []);
  useEffect(() => { remaining.current = 1; }, [preset]);
  useFrame((_,delta) => {
    if (remaining.current <= .01) return;
    remaining.current = THREE.MathUtils.damp(remaining.current,0,3.2,delta);
    camera.position.lerp(positions[preset],1-Math.exp(-delta*4.2));
    camera.lookAt(targets[preset]); camera.updateProjectionMatrix();
  });
  return null;
}

function TrackingHalo({color,active}:{color:string;active:boolean}) {
  const ref=useRef<THREE.Mesh>(null);
  useFrame(({clock}) => { if(ref.current&&active) ref.current.scale.setScalar(1+Math.sin(clock.elapsedTime*5)*.08); });
  return <mesh ref={ref} position={[0,-.5,0]} rotation={[-Math.PI/2,0,0]}>
    <ringGeometry args={[.34,.39,36]}/><meshBasicMaterial color={color} transparent opacity={active ? .65 : .16} toneMapped={false}/>
  </mesh>;
}

function Bottle({product}:{product:ProductUnit}) {
  const ref=useRef<THREE.Group>(null);
  const geometry=useMemo(() => new THREE.LatheGeometry([
    new THREE.Vector2(.22,-.47),new THREE.Vector2(.27,-.42),new THREE.Vector2(.285,-.31),
    new THREE.Vector2(.285,.25),new THREE.Vector2(.26,.37),new THREE.Vector2(.19,.45),new THREE.Vector2(.16,.48),
  ],32),[]);
  useEffect(() => () => geometry.dispose(),[geometry]);
  const reject=product.disposition==="REJECT", inReject=reject&&product.position>=84;
  const push=inReject?smooth(clamp((product.position-84)/7)):0;
  const drop=inReject?smooth(clamp((product.position-91)/10)):0;
  const conveyorX=-7.2+Math.min(product.position,108)*.135;
  const x=inReject?4.14+drop*.12:conveyorX, z=push*1.25+drop*2.35, y=1.02-drop*.74;
  const initialPosition=useRef({x,y,z});
  const signal=reject?RED:product.stage==="accepted"?"#55d88a":product.stage==="vision"||product.stage==="barcode"?SIGNAL:"#68a987";
  useLayoutEffect(() => {
    const initial=initialPosition.current;
    ref.current?.position.set(initial.x,initial.y,initial.z);
  },[]);
  useFrame((_,delta) => {
    if(!ref.current)return;
    ref.current.position.x=THREE.MathUtils.damp(ref.current.position.x,x,12,delta);
    ref.current.position.y=THREE.MathUtils.damp(ref.current.position.y,y,12,delta);
    ref.current.position.z=THREE.MathUtils.damp(ref.current.position.z,z,12,delta);
    ref.current.rotation.x=THREE.MathUtils.damp(ref.current.rotation.x,drop*1.15,8,delta);
    ref.current.rotation.z=THREE.MathUtils.damp(ref.current.rotation.z,-push*.14+drop*.48,8,delta);
  });
  return <group ref={ref}>
    <TrackingHalo color={signal} active={["vision","barcode","reject"].includes(product.stage)}/>
    <mesh geometry={geometry} castShadow receiveShadow><meshPhysicalMaterial color="#f0eee5" roughness={.52} clearcoat={.12} clearcoatRoughness={.5}/></mesh>
    <mesh position={[0,.01,0]} castShadow><cylinderGeometry args={[.29,.29,.3,32]}/><meshStandardMaterial color="#dce5db" roughness={.72}/></mesh>
    <mesh position={[0,.07,.286]}><planeGeometry args={[.29,.18]}/><meshStandardMaterial color="#f7fbf4" roughness={.8}/></mesh>
    <mesh position={[0,.07,.292]}><planeGeometry args={[.16,.11]}/><meshBasicMaterial color="#14201a"/></mesh>
    {[-.055,0,.055].map(v=><mesh key={v} position={[v,.07,.295]}><boxGeometry args={[.018,.09,.006]}/><meshBasicMaterial color="#dfe8df"/></mesh>)}
    <mesh position={[0,.5,0]} castShadow><cylinderGeometry args={[.16,.18,.13,28]}/><meshStandardMaterial color="#eef0e9" roughness={.62}/></mesh>
    <mesh position={[0,.61,0]} castShadow><cylinderGeometry args={[.202,.202,.12,28]}/><meshStandardMaterial color="#b7dc43" roughness={.54}/></mesh>
    {[-.04,0,.04].map(v=><mesh key={v} position={[0,.61+v,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.204,.008,8,28]}/><meshStandardMaterial color="#8dae32" roughness={.58}/></mesh>)}
    <pointLight color={signal} intensity={product.stage==="vision" || product.stage==="reject" ? .65 : 0} distance={1.3} position={[0,.8,0]}/>
  </group>;
}

function Beacon({position,color=SIGNAL,active=false}:{position:[number,number,number];color?:string;active?:boolean}) {
  const lens=useRef<THREE.Mesh>(null);
  useFrame(({clock}) => {if(lens.current)lens.current.scale.setScalar(active?1+Math.sin(clock.elapsedTime*7)*.07:1)});
  return <group position={position}>
    <mesh position={[0,.2,0]}><cylinderGeometry args={[.065,.065,.4,12]}/><meshStandardMaterial color="#303a35" metalness={.7}/></mesh>
    <mesh ref={lens} position={[0,.45,0]}><cylinderGeometry args={[.105,.105,.18,16]}/><meshStandardMaterial color={active?color:"#405048"} emissive={active?color:"#000"} emissiveIntensity={active?2.2:0} toneMapped={false}/></mesh>
    {active?<pointLight position={[0,.48,0]} color={color} intensity={1.5} distance={1.8}/>:null}
  </group>;
}

function Roller({x,spinning}:{x:number;spinning:boolean}) {
  const ref=useRef<THREE.Mesh>(null);
  useFrame((_,delta)=>{if(ref.current&&spinning)ref.current.rotation.z-=delta*4.8});
  return <mesh ref={ref} position={[x,.48,0]} rotation={[Math.PI/2,0,0]} castShadow receiveShadow><cylinderGeometry args={[.16,.16,1.2,18]}/><meshStandardMaterial color="#64716b" metalness={.82} roughness={.28}/></mesh>;
}

function Conveyor({running,reduced}:{running:boolean;reduced:boolean}) {
  return <group>
    <mesh receiveShadow position={[0,.3,0]}><boxGeometry args={[15.6,.24,1.46]}/><meshStandardMaterial color="#1d2924" metalness={.58} roughness={.4}/></mesh>
    {Array.from({length:44},(_,i)=><Roller key={i} x={-7.45+i*.35} spinning={running&&!reduced}/>)}
    {[-.74,.74].map(z=><group key={z}><mesh position={[0,.61,z]} castShadow><boxGeometry args={[15.8,.15,.11]}/><meshStandardMaterial color="#89938e" metalness={.86} roughness={.22}/></mesh><mesh position={[0,.08,z]}><boxGeometry args={[15.5,.62,.08]}/><meshStandardMaterial color="#35423c" metalness={.65} roughness={.34}/></mesh></group>)}
    {[-6.8,-3.4,0,3.4,6.8].map(x=><group key={x} position={[x,0,0]}>{[-.56,.56].map(z=><group key={z} position={[0,-.35,z]}><mesh><boxGeometry args={[.16,1.32,.16]}/><meshStandardMaterial color="#53605a" metalness={.7}/></mesh><mesh position={[0,-.68,0]}><boxGeometry args={[.36,.08,.36]}/><meshStandardMaterial color="#303c37" metalness={.55}/></mesh></group>)}<mesh position={[0,-.52,0]} rotation={[0,0,.29]}><boxGeometry args={[1.2,.1,.1]}/><meshStandardMaterial color="#45514c" metalness={.62}/></mesh></group>)}
    <group position={[6.7,-.1,-1.08]}><mesh rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.4,.4,.72,24]}/><meshStandardMaterial color="#28342f" metalness={.72} roughness={.3}/></mesh><mesh position={[.45,0,0]} castShadow><boxGeometry args={[.28,.58,.58]}/><meshStandardMaterial color={AMBER} roughness={.45}/></mesh></group>
  </group>;
}

function EntrySensor({active}:{active:boolean}) {
  return <group position={[-5.95,0,0]}>
    {[-.86,.86].map(z=><mesh key={z} position={[0,1.2,z]} castShadow><boxGeometry args={[.13,1.5,.13]}/><meshStandardMaterial color={STEEL} metalness={.8}/></mesh>)}
    <mesh position={[0,1.08,-.74]} castShadow><boxGeometry args={[.24,.24,.25]}/><meshStandardMaterial color="#18231f" emissive={active?SIGNAL:"#000"} emissiveIntensity={active?1.5:0}/></mesh>
    <mesh position={[0,1.08,0]}><boxGeometry args={[.018,.018,1.5]}/><meshBasicMaterial color={SIGNAL} transparent opacity={active ? .9 : .12} toneMapped={false}/></mesh>
    <Beacon position={[.2,1.62,-.75]} active={active}/>
  </group>;
}

function VisionStation({active,failed}:{active:boolean;failed:boolean}) {
  const scan=useRef<THREE.Mesh>(null), color=failed?RED:SIGNAL;
  useFrame(({clock})=>{if(scan.current)(scan.current.material as THREE.MeshBasicMaterial).opacity=active ? .12+Math.sin(clock.elapsedTime*9)*.05 : .02});
  return <group position={[-2.55,0,0]}>
    {[-.89,.89].map(z=><mesh key={z} position={[0,1.3,z]} castShadow><boxGeometry args={[.18,2.35,.18]}/><meshStandardMaterial color="#35413b" metalness={.76} roughness={.28}/></mesh>)}
    <mesh position={[0,2.43,0]} castShadow><boxGeometry args={[.2,.2,1.95]}/><meshStandardMaterial color="#35413b" metalness={.76}/></mesh>
    <group position={[0,2.12,.1]} rotation={[.22,0,0]}><mesh castShadow><boxGeometry args={[.58,.42,.5]}/><meshStandardMaterial color="#111a16" metalness={.62} roughness={.24}/></mesh><mesh position={[0,-.08,.27]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.13,.13,.11,24]}/><meshPhysicalMaterial color="#08100d" roughness={.08} metalness={.55} emissive={active?color:"#12251b"} emissiveIntensity={active?1.5:.12} toneMapped={false}/></mesh><mesh position={[0,-.08,.335]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.19,.035,10,32]}/><meshStandardMaterial color={active?"#f1fff3":"#69746f"} emissive={active?"#e6ffe9":"#000"} emissiveIntensity={active?1.6:0} toneMapped={false}/></mesh></group>
    <mesh ref={scan} position={[0,1.15,.02]} rotation={[-Math.PI/2,0,0]}><coneGeometry args={[.68,1.4,4,1,true]}/><meshBasicMaterial color={color} transparent opacity={.02} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
    <Beacon position={[.22,2.3,-.82]} color={color} active={active}/>
  </group>;
}

function BarcodeStation({active,failed}:{active:boolean;failed:boolean}) {
  const beam=useRef<THREE.Mesh>(null),color=failed?RED:"#63e6ff";
  useFrame(({clock})=>{if(beam.current&&active)beam.current.position.x=Math.sin(clock.elapsedTime*10)*.25});
  return <group position={[.62,0,0]}>
    <mesh position={[0,1.45,-.92]} castShadow><boxGeometry args={[.16,2.2,.16]}/><meshStandardMaterial color={STEEL} metalness={.78}/></mesh>
    <mesh position={[0,2.48,-.46]} castShadow><boxGeometry args={[.16,.16,1.05]}/><meshStandardMaterial color={STEEL} metalness={.78}/></mesh>
    <group position={[0,2.26,.02]} rotation={[.32,0,0]}><mesh castShadow><boxGeometry args={[.5,.35,.38]}/><meshStandardMaterial color="#101a16" metalness={.55} roughness={.25}/></mesh><mesh position={[0,-.04,.205]}><planeGeometry args={[.26,.16]}/><meshStandardMaterial color="#07100d" emissive={active?color:"#0b1712"} emissiveIntensity={active?1.25:.1}/></mesh></group>
    <mesh ref={beam} position={[0,1.25,0]}><boxGeometry args={[.025,1.25,1.08]}/><meshBasicMaterial color={color} transparent opacity={active ? .54 : .035} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
    <Beacon position={[.22,2.42,-.82]} color={color} active={active}/>
  </group>;
}

function RejectPusher({products}:{products:ProductUnit[]}) {
  const paddle=useRef<THREE.Group>(null),rod=useRef<THREE.Mesh>(null);
  const rejecting=products.find(p=>p.stage==="reject"&&p.position<=103), position=rejecting?.position??0;
  const stroke=(rejecting?smooth(clamp((position-82)/6)):0)*(rejecting?1-smooth(clamp((position-92)/7)):0);
  useFrame((_,delta)=>{
    if(paddle.current)paddle.current.position.z=THREE.MathUtils.damp(paddle.current.position.z,stroke*1.55,13,delta);
    if(rod.current){
      rod.current.scale.z=THREE.MathUtils.damp(rod.current.scale.z,.45+stroke*1.65,13,delta);
      rod.current.position.z=THREE.MathUtils.damp(rod.current.position.z,stroke*.77,13,delta);
    }
  });
  return <group position={[4.2,0,0]}>
    <group position={[0,.92,-1.32]}><mesh castShadow><boxGeometry args={[.82,.64,.7]}/><meshStandardMaterial color={DARK} metalness={.72} roughness={.3}/></mesh><mesh position={[0,0,.38]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.2,.2,.12,24]}/><meshStandardMaterial color="#9aa59f" metalness={.86} roughness={.18}/></mesh></group>
    <group position={[0,.92,-.89]}><mesh ref={rod} castShadow><boxGeometry args={[.13,.13,1]}/><meshStandardMaterial color="#e0e8e4" metalness={.96} roughness={.1}/></mesh></group>
    <group position={[0,.92,-.49]}><group ref={paddle}><mesh castShadow><boxGeometry args={[.92,.68,.13]}/><meshStandardMaterial color={AMBER} metalness={.42} roughness={.34}/></mesh><mesh position={[0,0,.075]}><boxGeometry args={[.68,.45,.025]}/><meshStandardMaterial color="#d63d34" roughness={.58}/></mesh>{[[-.31,.2],[.31,.2],[-.31,-.2],[.31,-.2]].map(([x,y],i)=><mesh key={i} position={[x,y,.096]}><cylinderGeometry args={[.025,.025,.02,12]}/><meshStandardMaterial color="#202723" metalness={.8}/></mesh>)}</group></group>
    <Beacon position={[.38,1.5,-1.35]} color={RED} active={Boolean(rejecting)}/>
  </group>;
}

function RejectLane() {
  return <group>
    {Array.from({length:8},(_,i)=><mesh key={i} position={[4.24,.49-i*.055,1.18+i*.34]} rotation={[0,0,Math.PI/2]} castShadow receiveShadow><cylinderGeometry args={[.115,.115,1.05,18]}/><meshStandardMaterial color={i%2?"#59655f":"#748078"} metalness={.78} roughness={.3}/></mesh>)}
    {[3.64,4.84].map(x=><group key={x}><mesh position={[x,.5,2.32]} rotation={[-.16,0,0]} castShadow><boxGeometry args={[.09,.52,2.95]}/><meshStandardMaterial color={AMBER} metalness={.35} roughness={.5}/></mesh><mesh position={[x,.08,2.32]} rotation={[-.16,0,0]}><boxGeometry args={[.1,.12,3]}/><meshStandardMaterial color="#3b4741" metalness={.62}/></mesh></group>)}
    <group position={[4.24,-.25,4.02]}><mesh position={[0,-.36,0]} receiveShadow><boxGeometry args={[1.95,.12,1.58]}/><meshStandardMaterial color="#111916" roughness={.82}/></mesh>{[-.98,.98].map(x=><mesh key={x} position={[x,.1,0]} castShadow><boxGeometry args={[.12,1.05,1.58]}/><meshStandardMaterial color="#35413b" metalness={.42} roughness={.52}/></mesh>)}<mesh position={[0,.1,.74]} castShadow><boxGeometry args={[1.95,1.05,.12]}/><meshStandardMaterial color="#27332e" metalness={.4}/></mesh><mesh position={[0,.18,.81]}><planeGeometry args={[1.5,.4]}/><meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={.1}/></mesh></group>
  </group>;
}

function FactoryHall() {
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.95,0]} receiveShadow><planeGeometry args={[30,20]}/><meshStandardMaterial color="#111914" roughness={.94}/></mesh><gridHelper args={[30,30,"#355444","#1c3026"]} position={[0,-.93,0]}/>
    <mesh position={[0,3.2,-4.65]} receiveShadow><boxGeometry args={[24,8,.2]}/><meshStandardMaterial color="#131d19" roughness={.84}/></mesh>
    {[-8,-4,0,4,8].map(x=><mesh key={x} position={[x,2.7,-4.39]}><boxGeometry args={[.18,7,.18]}/><meshStandardMaterial color="#3e4c45" metalness={.65}/></mesh>)}
    {[-5,0,5].map(x=><group key={x} position={[x,5.15,-1.7]}><mesh><boxGeometry args={[3.1,.12,1.05]}/><meshStandardMaterial color="#d9f0dc" emissive="#bfffd3" emissiveIntensity={1.15} toneMapped={false}/></mesh><pointLight position={[0,-.4,0]} color="#d7ffe3" intensity={2.2} distance={7}/></group>)}
    <group position={[-6.4,.2,-3.72]}><mesh position={[0,.95,0]} castShadow><boxGeometry args={[1.5,2.5,.62]}/><meshStandardMaterial color="#69746f" metalness={.65} roughness={.33}/></mesh><mesh position={[0,1.15,.321]}><planeGeometry args={[1.18,1.65]}/><meshStandardMaterial color="#353f3a"/></mesh><mesh position={[0,1.48,.335]}><planeGeometry args={[.82,.55]}/><meshStandardMaterial color="#07120d" emissive="#2a8050" emissiveIntensity={.35}/></mesh></group>
    <group position={[4.2,0,-2.05]}>{[-1.2,0,1.2].map(x=><mesh key={x} position={[x,.55,0]} castShadow><boxGeometry args={[.08,2.9,.08]}/><meshStandardMaterial color={AMBER}/></mesh>)}<mesh position={[0,.55,0]}><planeGeometry args={[2.4,2.75,12,12]}/><meshStandardMaterial color="#9aa49f" wireframe transparent opacity={.28}/></mesh></group>
  </group>;
}

function Factory({products,running,reduced}:{products:ProductUnit[];running:boolean;reduced:boolean}) {
  const entry=products.some(p=>p.stage==="entry"),vision=products.find(p=>p.stage==="vision"),barcode=products.find(p=>p.stage==="barcode");
  return <><color attach="background" args={["#07100c"]}/><fog attach="fog" args={["#07100c",13,29]}/><ambientLight intensity={.34}/><hemisphereLight args={["#d9ffe4","#07100c",1]}/><directionalLight castShadow position={[-5,9,7]} intensity={1.65} color="#e8f8ed" shadow-mapSize={[1024,1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={9} shadow-camera-bottom={-5}/><pointLight position={[-2,4,2]} color={SIGNAL} intensity={1.4} distance={9}/><FactoryHall/><Conveyor running={running} reduced={reduced}/><EntrySensor active={entry}/><VisionStation active={Boolean(vision)} failed={vision?.visionResult==="FAIL"}/><BarcodeStation active={Boolean(barcode)} failed={barcode?.barcodeResult==="FAIL"||barcode?.barcodeResult==="TIMEOUT"}/><RejectPusher products={products}/><RejectLane/>{products.map(p=><Bottle key={p.id} product={p}/>)}<ContactShadows position={[0,-.91,0]} opacity={.62} scale={24} blur={2.6} far={6}/></>;
}

export function FactoryScene({products,running,cameraPreset}:{products:ProductUnit[];running:boolean;cameraPreset:CameraPreset}) {
  const reduced=useReducedMotion();
  const target:Record<CameraPreset,[number,number,number]>={overview:[0,.55,.2],inspection:[-1.05,1.05,0],reject:[4.25,.58,1.65]};
  return <Canvas shadows dpr={[1,1.65]} camera={{position:[11.8,7.1,13.6],fov:38,near:.1,far:90}} gl={{antialias:true,powerPreference:"high-performance",toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.02}}>
    <CameraRig preset={cameraPreset}/><Factory products={products} running={running} reduced={reduced}/><OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={.06} minDistance={5} maxDistance={24} minPolarAngle={.48} maxPolarAngle={1.38} target={target[cameraPreset]}/>
    {!reduced?<EffectComposer multisampling={0}><Bloom intensity={.46} luminanceThreshold={.9} luminanceSmoothing={.16} mipmapBlur/><Noise opacity={.012} blendFunction={BlendFunction.SOFT_LIGHT}/><Vignette offset={.25} darkness={.58}/></EffectComposer>:null}
  </Canvas>;
}
