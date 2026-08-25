"use client";

import { useEffect, useState } from "react";
import { ControlDock, LiveLine, QualityView, SystemMap, TraceExplorer } from "@/components/DashboardViews";
import { useLineSimulator } from "@/hooks/useLineSimulator";

type View = "live" | "trace" | "quality" | "system";
const nav: { id:View; number:string; label:string }[] = [
  {id:"live",number:"01",label:"Live line"},{id:"trace",number:"02",label:"Trace explorer"},{id:"quality",number:"03",label:"Quality & alarms"},{id:"system",number:"04",label:"System map"},
];

export default function Home() {
  const sim=useLineSimulator(); const [view,setView]=useState<View>("live"); const [time,setTime]=useState("");
  useEffect(()=>{const tick=()=>setTime(new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:"Asia/Jakarta"}).format(new Date()));tick();const t=setInterval(tick,1000);return()=>clearInterval(t)},[]);
  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={()=>setView("live")} aria-label="FactoryTrace home"><span className="brand-mark">FT</span><span><strong>FACTORYTRACE</strong><small>Traceability digital twin</small></span></button><div className="line-identity"><span>PT NUSA VITA NUTRINDO</span><b>PKG—02</b></div><div className="status-cluster"><span className={`status-pill ${sim.lineState === "RUNNING"?"running":"stopped"}`}><i/>AUTO · {sim.lineState}</span><span className="status-pill"><i/>OPC UA · 18 ms</span><time>{time} WIB</time></div></header>
    <nav className="rail" aria-label="Primary navigation">{nav.map((item)=><button key={item.id} className={`rail-button ${view===item.id?"active":""}`} aria-label={item.label} data-tip={item.label} onClick={()=>setView(item.id)}>{item.number}</button>)}<span className="rail-line"/><span className="rail-caption">{nav.find(n=>n.id===view)?.label.toUpperCase()}</span></nav>
    <section className={`workspace view-${view}`} id="top">{view==="live"&&<LiveLine sim={sim}/>} {view==="trace"&&<TraceExplorer products={[...sim.activeProducts,...sim.recentProducts]}/>} {view==="quality"&&<QualityView products={sim.recentProducts} alarms={sim.alarms} acknowledge={sim.acknowledge}/>} {view==="system"&&<SystemMap/>}</section>
    {view==="live"&&<ControlDock sim={sim}/>}<div className="fictitious-note">DEMONSTRATION DATA · PT NUSA VITA NUTRINDO IS A FICTITIOUS COMPANY</div>
  </main>;
}
