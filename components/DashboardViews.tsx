"use client";
/* eslint-disable jsx-a11y/label-has-associated-control -- Decorative architecture layer labels are not form controls. */

import { useEffect, useState } from "react";
import { FactoryScene } from "./FactoryScene";
import { scenarioLabels, type Alarm, type ProductEvent, type ProductUnit, type Scenario, workOrder } from "@/lib/domain";

type Simulator = ReturnType<typeof import("@/hooks/useLineSimulator").useLineSimulator>;

function ResultBadge({ value }:{value:string}) {
  const tone = value === "PASS" || value === "ACCEPT" ? "ok" : value === "PENDING" ? "pending" : "ng";
  return <span className={`result-badge ${tone}`}>{value}</span>;
}

function EventRow({ event }:{event:ProductEvent}) {
  return <div className="event"><time>{event.at}</time><i className={event.tone}/><p><b>{event.title}</b><span>{event.detail}</span></p></div>;
}

function stageIndex(product:ProductUnit) {
  if (product.stage === "created") return 0;
  if (product.stage === "entry") return 1;
  if (product.stage === "vision") return 2;
  if (product.stage === "barcode") return 3;
  return 4;
}

export function LiveLine({ sim }:{sim:Simulator}) {
  const [camera,setCamera] = useState<"overview"|"inspection"|"reject">("overview");
  const total = 3427 + Math.max(0,sim.recentProducts.length-6);
  const rejected = 66 + sim.recentProducts.slice(0,Math.max(0,sim.recentProducts.length-6)).filter((p) => p.disposition === "REJECT").length;
  const accepted = total-rejected;
  const current = sim.currentProduct;
  const stage = stageIndex(current);
  return <>
    <div className="section-heading">
      <div><p className="eyebrow">SECONDARY PACKAGING HALL / CIKARANG</p><h1>Live production line</h1></div>
      <div className="order-progress"><span>{workOrder.orderNumber}</span><strong>{total.toLocaleString("en-US")} <small>/ {workOrder.target.toLocaleString("en-US")} bottles</small></strong><div className="progress"><i style={{width:`${Math.min(total/workOrder.target*100,100)}%`}}/></div></div>
    </div>
    <section className="hero-grid">
      <article className="digital-twin-card">
        <div className="panel-label"><span>DIGITAL TWIN / {camera.toUpperCase()}</span><div className="camera-tabs"><button onClick={() => setCamera("overview")} className={camera === "overview" ? "selected":""}>OVERVIEW</button><button onClick={() => setCamera("inspection")} className={camera === "inspection" ? "selected":""}>INSPECTION</button><button onClick={() => setCamera("reject")} className={camera === "reject" ? "selected":""}>REJECT</button></div></div>
        <div className="factory-canvas"><FactoryScene products={sim.activeProducts} running={sim.lineState === "RUNNING"} cameraPreset={camera}/><div className="station-overlay"><span>ENTRY / S01</span><span>VISION / S02</span><span>BARCODE / S03</span><span>REJECT / S04</span></div><div className="canvas-hint">DRAG TO ORBIT · SCROLL TO ZOOM</div></div>
        <div className="scene-footer"><span><i className="legend live"/>Live product</span><span><i className="legend pass"/>Accepted</span><span><i className="legend reject"/>Reject queued</span><b>{sim.lineState === "RUNNING" ? "30.2":"0.0"} <small>BPM</small></b></div>
      </article>
      <aside className="work-order-card">
        <div className="panel-label"><span>ACTIVE WORK ORDER</span><b>SHIFT 2</b></div><p className="product-code">{workOrder.sku}</p><h2>VITANUSA<br/>Immuno C+Zinc</h2><p className="product-meta">{workOrder.packaging}</p>
        <dl><div><dt>Batch</dt><dd>{workOrder.batch}</dd></div><div><dt>Manufactured</dt><dd>{workOrder.manufactured}</dd></div><div><dt>Expiry</dt><dd>{workOrder.expiry}</dd></div><div><dt>Nominal rate</dt><dd>{workOrder.nominalRate} BPM</dd></div></dl>
        <div className="operator-note"><i>RP</i><span><small>Production supervisor</small>{workOrder.supervisor}</span></div>
      </aside>
    </section>
    <section className="kpi-row"><div><span>Total inspected</span><strong>{total.toLocaleString("en-US")}</strong><small>+412 this hour</small></div><div><span>Accepted</span><strong>{accepted.toLocaleString("en-US")}</strong><small className="good">{(accepted/total*100).toFixed(2)}% pass rate</small></div><div><span>Rejected</span><strong>{rejected}</strong><small>{(rejected/total*100).toFixed(2)}% of inspected</small></div><div><span>Current cycle</span><strong>{sim.lineState === "RUNNING" ? "1.98":"—"}<em>{sim.lineState === "RUNNING" ? "s":""}</em></strong><small>Target ≤ 2.00 s</small></div></section>
    <section className="bottom-grid">
      <article className="current-product"><div className="panel-label"><span>CURRENT PRODUCT</span><b>SEQ {String(current.sequence).padStart(5,"0")}</b></div><code>{current.serial}</code><div className="inspection-strip"><div className={stage>=1?"done":""}><span>01</span><b>Entry</b><small>{stage>=1?"Detected":"Waiting"}</small></div><div className={stage>=2?current.visionResult === "FAIL"?"failed":"done":""}><span>02</span><b>Vision</b><small>{current.visionResult}</small></div><div className={stage>=3?current.barcodeResult === "PASS"?"done":"failed":stage===2?"active":""}><span>03</span><b>Barcode</b><small>{current.barcodeResult}</small></div><div className={stage>=4?current.disposition === "ACCEPT"?"done":"failed":""}><span>04</span><b>Disposition</b><small>{current.disposition}</small></div></div></article>
      <article className="event-card"><div className="panel-label"><span>LIVE EVENTS</span><b>{sim.liveEvents.length} LATEST</b></div>{sim.liveEvents.slice(0,3).map((e) => <EventRow event={e} key={e.id}/>)}</article>
    </section>
  </>;
}

function Replay({ product }:{product:ProductUnit}) {
  const [position,setPosition] = useState(0);
  const [playing,setPlaying] = useState(false);
  useEffect(() => { if (!playing) return; const timer=window.setInterval(() => setPosition((p) => { if (p>=105){setPlaying(false);return 105} return p+1.25 }),100); return()=>clearInterval(timer)},[playing]);
  const stage = position<8?"created":position<32?"entry":position<55?"vision":position<66?"barcode":position<82?"decision":product.disposition === "REJECT"?"reject":"accepted";
  const replayProduct={...product,id:`replay-${product.id}`,position,stage:stage as ProductUnit["stage"],completedAt:null};
  return <div className="replay-box"><div className="replay-canvas"><FactoryScene products={[replayProduct]} running={playing} cameraPreset="overview"/><span className="historical-label">HISTORICAL REPLAY</span></div><div className="replay-controls"><button onClick={() => {if(position>=105)setPosition(0);setPlaying(!playing)}}>{playing?"Ⅱ PAUSE":"▶ PLAY JOURNEY"}</button><button onClick={() => {setPlaying(false);setPosition(0)}}>↺ RESTART</button><div><i style={{width:`${position/105*100}%`}}/></div><span>{Math.min(Math.round(position/105*100),100)}%</span></div></div>;
}

export function TraceExplorer({ products }:{products:ProductUnit[]}) {
  const [query,setQuery]=useState(""); const [selectedId,setSelectedId]=useState(products[0]?.id);
  const filtered=products.filter((p)=>p.serial.toLowerCase().includes(query.toLowerCase())||String(p.sequence).includes(query));
  const selected=products.find((p)=>p.id===selectedId)??filtered[0]??products[0];
  return <><div className="section-heading"><div><p className="eyebrow">UNIT-LEVEL GENEALOGY</p><h1>Trace explorer</h1></div><label className="trace-search" htmlFor="trace-query"><span>⌕</span><input id="trace-query" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search serial or sequence…"/></label></div><section className="trace-layout"><aside className="product-list"><div className="panel-label"><span>RECENT PRODUCTS</span><b>{filtered.length} RECORDS</b></div>{filtered.map((p)=><button className={p.id===selected.id?"active":""} key={p.id} onClick={()=>setSelectedId(p.id)}><span><code>{p.serial}</code><small>{p.completedAt ? new Date(p.completedAt).toLocaleTimeString("id-ID",{timeZone:"Asia/Jakarta"}):"In progress"} · SEQ {p.sequence}</small></span><ResultBadge value={p.disposition}/></button>)}</aside><article className="trace-detail"><div className="trace-title"><div><p className="eyebrow">SERIALIZED UNIT</p><h2>{selected.serial}</h2></div><ResultBadge value={selected.disposition}/></div><div className="trace-facts"><div><span>Work order</span><b>{workOrder.orderNumber}</b></div><div><span>Batch</span><b>{workOrder.batch}</b></div><div><span>Vision</span><b>{selected.visionResult} · {selected.labelOffsetMm ?? "—"} mm</b></div><div><span>Barcode</span><b>{selected.barcodeResult} · Grade {selected.codeGrade ?? "—"}</b></div><div><span>Reason</span><b>{selected.reasonCode ?? "ALL_GATES_PASSED"}</b></div><div><span>Line / shift</span><b>PKG-02 · Shift 2</b></div></div><Replay product={selected}/><div className="journey"><div className="panel-label"><span>EVENT JOURNEY</span><b>APPEND-ONLY LOG</b></div>{[...selected.events].reverse().map((e)=><div className="journey-event" key={e.id}><time>{e.at}</time><i className={e.tone}/><span><b>{e.station} · {e.title}</b><small>{e.detail}</small></span></div>)}</div></article></section></>;
}

export function QualityView({ products,alarms,acknowledge }:{products:ProductUnit[];alarms:Alarm[];acknowledge:(id:string)=>void}) {
  const reasons=[{code:"VISION_LABEL_SKEW",count:24,color:"#c64c3e"},{code:"BARCODE_NO_READ",count:19,color:"#d49021"},{code:"BARCODE_DUPLICATE",count:13,color:"#88928d"},{code:"BACKEND_TIMEOUT",count:10,color:"#172821"}].map((r)=>({...r,count:r.count+products.filter((p)=>p.reasonCode===r.code).length}));
  const max=Math.max(...reasons.map((r)=>r.count));
  return <><div className="section-heading"><div><p className="eyebrow">QUALITY CONTROL / SHIFT 2</p><h1>Quality & alarms</h1></div><div className="quality-score"><span>FIRST PASS YIELD</span><b>98.07%</b></div></div><section className="quality-grid"><article className="pareto-card"><div className="panel-label"><span>REJECT REASON DISTRIBUTION</span><b>66 TOTAL</b></div><div className="bars">{reasons.map((r,i)=><div className="bar-row" key={r.code}><span>{String(i+1).padStart(2,"0")}</span><b>{r.code.replaceAll("_"," ")}</b><div><i style={{width:`${r.count/max*100}%`,background:r.color}}/></div><strong>{r.count}</strong></div>)}</div><p className="chart-note">Vision label alignment remains the primary reject contributor this shift. Inspection tolerance: ±2.0 mm.</p></article><article className="alarm-panel"><div className="panel-label"><span>ACTIVE ALARMS</span><b>{alarms.filter((a)=>!a.acknowledged).length} OPEN</b></div>{alarms.length===0?<div className="empty-state"><i>✓</i><b>No active alarms</b><span>All monitored systems are healthy.</span></div>:alarms.map((a)=><div className={`alarm-item ${a.acknowledged?"ack":""}`} key={a.id}><span className="alarm-severity">{a.severity}</span><div><b>{a.code} · {a.source}</b><p>{a.message}</p><small>Raised {a.raisedAt}</small></div>{!a.acknowledged?<button onClick={()=>acknowledge(a.id)}>ACKNOWLEDGE</button>:<em>ACKNOWLEDGED</em>}</div>)}</article></section><section className="device-health"><div><i className="healthy"/><span><b>KV-8000A</b><small>OPC UA server · 18 ms</small></span></div><div><i className="healthy"/><span><b>IV3-G120</b><small>Vision inspection · Ready</small></span></div><div><i className="healthy"/><span><b>SR-1000</b><small>Code reader · Ready</small></span></div><div><i className={alarms.some(a=>!a.acknowledged)?"warning":"healthy"}/><span><b>Traceability service</b><small>{alarms.some(a=>!a.acknowledged)?"Degraded":"Healthy · 12 ms"}</small></span></div></section></>;
}

export function SystemMap() {
  const tags=["Line.State","Line.SpeedActual","Order.Number","Product.Sequence","Product.Serial","Product.VisionResult","Product.BarcodeResult","Product.Disposition","Command.StartRequest","Command.StopRequest"];
  return <><div className="section-heading"><div><p className="eyebrow">OT / IT INTEGRATION CONTRACT</p><h1>System architecture</h1></div><span className="simulation-disclaimer">SIMULATED INTERFACES · HARDWARE ISOLATED</span></div><section className="architecture-card"><div className="architecture-layer field"><label>LEVEL 0—1 / FIELD & CONTROL</label><div className="arch-nodes"><div className="arch-node"><span>SENSOR</span><b>Keyence IV3-G120</b><small>Vision · cap & label judgment</small><em>EtherNet/IP</em></div><div className="arch-node primary"><span>PLC / OPC UA SERVER</span><b>Keyence KV-8000A</b><small>Sequence · interlock · product FIFO</small><em>opc.tcp://pkg02-plc:4840</em></div><div className="arch-node"><span>CODE READER</span><b>Keyence SR-1000</b><small>Serialized 2D code verification</small><em>EtherNet/IP</em></div></div></div><div className="protocol-bridge"><i/><span>OPC UA · Sign & Encrypt · Subscription 100 ms</span><i/></div><div className="architecture-layer it"><label>LEVEL 3 / TRACEABILITY</label><div className="arch-nodes two"><div className="arch-node backend"><span>OPC UA CLIENT / APPLICATION</span><b>FactoryTrace backend</b><small>Validation · correlation · genealogy</small><em>REST + WebSocket to UI</em></div><div className="arch-node database"><span>PERSISTENCE</span><b>Product history database</b><small>Units · inspections · events · alarms</small><em>Append-only product events</em></div></div></div></section><section className="tag-contract"><div><p className="eyebrow">OPC UA NAMESPACE</p><h2>PKG-02 tag contract</h2><p>Structured nodes keep the web application independent from raw PLC register addresses. The real adapter can replace this simulator after commissioning.</p></div><div className="tag-list">{tags.map((tag,i)=><code key={tag}><span>{String(i+1).padStart(2,"0")}</span>FactoryTrace/PKG02/{tag.replace(".","/")}</code>)}</div></section></>;
}

export function ControlDock({ sim }:{sim:Simulator}) {
  return <footer className="control-dock"><div className="control-buttons">{sim.lineState === "RUNNING"?<button className="stop" onClick={()=>sim.setLineState("STOPPED")}>■ CONTROLLED STOP</button>:<button className="start" onClick={()=>sim.setLineState("RUNNING")}>▶ START LINE</button>}<button onClick={sim.reset}>↻ RESET</button></div><label className="scenario-picker" htmlFor="scenario"><span>NEXT PRODUCT SCENARIO</span><select id="scenario" value={sim.scenario} onChange={(e)=>sim.setScenario(e.target.value as Scenario)}>{(Object.keys(scenarioLabels) as Scenario[]).map((key)=><option value={key} key={key}>{scenarioLabels[key]}</option>)}</select></label><button className="inject" onClick={sim.inject} disabled={sim.lineState!=="RUNNING"}>＋ INJECT PRODUCT</button><p>SIMULATION MODE <span>Hardware outputs are isolated</span></p></footer>;
}
