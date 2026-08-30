"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { productSerial, type Alarm, type ProductEvent, type ProductUnit, type Scenario } from "@/lib/domain";
import { seedProducts } from "@/lib/seed-data";

const clock = () => new Intl.DateTimeFormat("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit", fractionalSecondDigits:3, hour12:false, timeZone:"Asia/Jakarta" }).format(new Date());
const iso = () => new Date().toISOString();
const event = (product:ProductUnit, station:string, type:string, title:string, detail:string, tone:ProductEvent["tone"]): ProductEvent => ({ id:`${product.id}-${type}`, at:clock(), station, type, title, detail, tone });
const bridgeUrl = "http://127.0.0.1:4001";
type LineState = "RUNNING"|"STOPPED"|"EMERGENCY_STOP";
type PlcSnapshot = { lineState:LineState; scenario?:Scenario; activeProducts:ProductUnit[]; recentProducts:ProductUnit[]; alarms:Alarm[] };
async function bridgeCommand(command:string,value?:unknown) {
  const response=await fetch(`${bridgeUrl}/api/command`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({command,value})});
  if (!response.ok) throw new Error(`PLC bridge rejected ${command} (${response.status})`);
}

function advanceProduct(product:ProductUnit): ProductUnit {
  const next = { ...product, events:[...product.events] };
  if (next.stage === "created" && next.position >= 8) {
    next.stage = "entry";
    next.events.unshift(event(next,"S01","PRODUCT_ENTERED","Product entered",`Tracking sequence ${String(next.sequence).padStart(5,"0")} allocated`,"neutral"));
  }
  if (next.stage === "entry" && next.position >= 32) {
    next.stage = "vision";
    const failed = next.scenario === "vision_defect";
    next.visionResult = failed ? "FAIL" : "PASS";
    next.labelOffsetMm = failed ? 4.8 : .4;
    next.capConfidence = failed ? 97.1 : 99.2;
    next.events.unshift(event(next,"S02","VISION_COMPLETED",`Vision ${failed ? "FAIL" : "PASS"}`,failed ? "Label offset +4.8 mm exceeds ±2.0 mm" : "Label offset +0.4 mm · cap confidence 99.2%",failed ? "bad" : "good"));
  }
  if (next.stage === "vision" && next.position >= 55) {
    next.stage = "barcode";
    if (next.scenario === "barcode_no_read") {
      next.barcodeResult = "FAIL"; next.codeGrade = null;
      next.events.unshift(event(next,"S03","BARCODE_NO_READ","Barcode no-read","Decode attempt exceeded 450 ms","bad"));
    } else if (next.scenario === "duplicate_serial") {
      next.barcodeResult = "FAIL"; next.codeGrade = "A";
      next.events.unshift(event(next,"S03","BARCODE_DUPLICATE","Duplicate serial","Serial already commissioned at 15:41:11","bad"));
    } else if (next.scenario === "backend_timeout") {
      next.barcodeResult = "TIMEOUT"; next.codeGrade = "A";
      next.events.unshift(event(next,"S03","VALIDATION_TIMEOUT","Backend validation timeout","No response within 500 ms fail-safe window","bad"));
    } else {
      next.barcodeResult = "PASS"; next.codeGrade = "A";
      next.events.unshift(event(next,"S03","BARCODE_VALIDATED","Serial validated",`${next.serial} · Grade A`,"good"));
    }
  }
  if (next.stage === "barcode" && next.position >= 66) {
    next.stage = "decision";
    const reasons:Partial<Record<Scenario,string>> = { vision_defect:"VISION_LABEL_SKEW", barcode_no_read:"BARCODE_NO_READ", duplicate_serial:"BARCODE_DUPLICATE", backend_timeout:"BACKEND_TIMEOUT" };
    next.reasonCode = reasons[next.scenario] ?? null;
    next.disposition = next.reasonCode ? "REJECT" : "ACCEPT";
    next.events.unshift(event(next,"PLC","DISPOSITION_SET",`Disposition ${next.disposition}`,next.reasonCode ?? "All quality gates satisfied",next.disposition === "ACCEPT" ? "good" : "warn"));
  }
  if (next.stage === "decision" && next.position >= 82) {
    next.stage = next.disposition === "REJECT" ? "reject" : "accepted";
    next.events.unshift(event(next,"S04",next.disposition === "REJECT" ? "REJECT_ACTUATED" : "PRODUCT_ACCEPTED",next.disposition === "REJECT" ? "Reject sequence started" : "Product accepted",next.disposition === "REJECT" ? `${next.reasonCode} · pneumatic pusher extending` : "Released to case packing",next.disposition === "REJECT" ? "warn" : "good"));
  }
  if (next.stage === "reject" && next.position >= 100 && !next.events.some((item) => item.type === "REJECT_CONFIRMED")) {
    next.events.unshift(event(next,"S04","REJECT_CONFIRMED","Reject confirmed",`${next.reasonCode} · reject-bin sensor occupied`,"warn"));
  }
  if ((next.stage === "accepted" || next.stage === "reject") && next.position >= 104 && !next.completedAt) next.completedAt = iso();
  return next;
}

export function useLineSimulator() {
  const [lineState,setLineStateLocal] = useState<LineState>("RUNNING");
  const [activeProducts,setActiveProducts] = useState<ProductUnit[]>([]);
  const [recentProducts,setRecentProducts] = useState<ProductUnit[]>(seedProducts);
  const [alarms,setAlarms] = useState<Alarm[]>([]);
  const [scenario,setScenario] = useState<Scenario>("normal");
  const [integrationMode,setIntegrationMode] = useState<"BROWSER_SIM"|"OPC_UA">("BROWSER_SIM");
  const [opcConnected,setOpcConnected] = useState(false);
  const sequence = useRef(1842);
  const persistedProductIds = useRef(new Set<string>());

  const sendBridgeCommand = useCallback(async (command:string,value?:unknown) => {
    try {
      await bridgeCommand(command,value);
    } catch {
      // Keep the last authoritative PLC state visible. A transport failure is
      // not evidence that the physical line stopped.
      setOpcConnected(false);
    }
  },[]);

  useEffect(() => {
    fetch("/api/products").then((response) => response.ok ? response.json() : Promise.reject()).then((value:unknown) => {
      const data=value as {products:ProductUnit[]};
      if (!data.products?.length) return;
      data.products.forEach((product) => persistedProductIds.current.add(product.id));
      setRecentProducts((current) => {
        const merged=[...data.products,...current];
        return merged.filter((product,index) => merged.findIndex((candidate) => candidate.id === product.id) === index).slice(0,24);
      });
      sequence.current=Math.max(sequence.current,...data.products.map((product) => product.sequence+1));
    }).catch(() => undefined);
  },[]);

  useEffect(() => {
    let events:EventSource|undefined;
    let cancelled=false;
    fetch(`${bridgeUrl}/health`).then((response) => response.ok ? response.json() : Promise.reject()).then(() => {
      if(cancelled) return;
      setIntegrationMode("OPC_UA"); setOpcConnected(true);
      events=new EventSource(`${bridgeUrl}/api/events`);
      events.onopen=() => setOpcConnected(true);
      events.onmessage=(message) => {
        try {
          const data=JSON.parse(message.data) as PlcSnapshot;
          setLineStateLocal(data.lineState); setActiveProducts(data.activeProducts); setAlarms(data.alarms);
          if(data.scenario) setScenario(data.scenario);
          if(data.recentProducts.length) {
            for (const product of data.recentProducts) {
              if (persistedProductIds.current.has(product.id)) continue;
              persistedProductIds.current.add(product.id);
              void fetch("/api/products", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(product) }).catch(() => persistedProductIds.current.delete(product.id));
            }
            setRecentProducts((current) => [...data.recentProducts,...current].filter((product,index,list) => list.findIndex((candidate) => candidate.id === product.id) === index).slice(0,24));
          }
        } catch {
          setOpcConnected(false);
        }
      };
      events.onerror=() => setOpcConnected(false);
    }).catch(() => { if(!cancelled){setIntegrationMode("BROWSER_SIM");setOpcConnected(false);} });
    return () => { cancelled=true; events?.close(); };
  },[]);

  useEffect(() => {
    if (integrationMode !== "BROWSER_SIM" || lineState !== "RUNNING") return;
    const timer = window.setInterval(() => {
      const completed:ProductUnit[] = [];
      setActiveProducts((current) => current.map((p) => {
        // Slow only the physical reject stroke so the actuator, transfer, and
        // confirmation are observable. The main conveyor keeps its normal rate.
        const increment = p.stage === "reject" ? .5 : 1.25;
        return advanceProduct({ ...p, position:p.position+increment });
      }).filter((p) => {
        if (p.completedAt) completed.push(p);
        return !p.completedAt;
      }));
      if (completed.length) {
        setRecentProducts((current) => [...completed,...current].slice(0,24));
        completed.forEach((p) => fetch("/api/products", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(p) }).catch(() => undefined));
      }
    },100);
    return () => window.clearInterval(timer);
  },[integrationMode,lineState]);

  const inject = useCallback(() => {
    if (lineState !== "RUNNING") return false;
    const selectedScenario = scenario;
    if (integrationMode === "OPC_UA") {
      void sendBridgeCommand("inject",selectedScenario);
      setScenario("normal");
      return true;
    }
    const seq = sequence.current++;
    const id = `live-${Date.now()}-${seq}`;
    const serial = selectedScenario === "duplicate_serial" ? seedProducts[0].serial : productSerial(seq);
    const product:ProductUnit = { id, sequence:seq, serial, scenario:selectedScenario, position:0, stage:"created", visionResult:"PENDING", barcodeResult:"PENDING", disposition:"PENDING", reasonCode:null, labelOffsetMm:null, capConfidence:null, codeGrade:null, createdAt:iso(), completedAt:null, events:[{ id:`${id}-created`, at:clock(), station:"PLC", type:"TRACKING_CREATED", title:"Tracking record created", detail:`Scenario profile · ${selectedScenario.replaceAll("_"," ")}`, tone:"neutral" }] };
    setActiveProducts((current) => [...current,product]);
    setScenario("normal");
    if (selectedScenario === "backend_timeout") window.setTimeout(() => setAlarms((current) => [{ id:`alarm-${Date.now()}`, code:"COM-BE-500", severity:"CRITICAL", source:"Traceability backend", message:"Validation response exceeded 500 ms fail-safe window", raisedAt:clock(), acknowledged:false },...current]),4600);
    return true;
  },[integrationMode,lineState,scenario,sendBridgeCommand]);

  const setLineState = useCallback((state:LineState) => {
    if(integrationMode === "OPC_UA") { void sendBridgeCommand(state === "RUNNING" ? "start" : state === "EMERGENCY_STOP" ? "emergency" : "stop"); return; }
    setLineStateLocal(state);
  },[integrationMode,sendBridgeCommand]);
  const reset = useCallback(() => {
    if(integrationMode === "OPC_UA") { void sendBridgeCommand("reset"); return; }
    setActiveProducts([]); setAlarms([]); setLineStateLocal("STOPPED");
  },[integrationMode,sendBridgeCommand]);
  const emergencyStop = useCallback(() => {
    if(integrationMode === "OPC_UA") { void sendBridgeCommand("emergency"); return; }
    setLineStateLocal("EMERGENCY_STOP");
    setAlarms((current) => current.some((alarm) => alarm.code === "SAFETY-ESTOP" && !alarm.acknowledged) ? current : [{ id:`alarm-estop-${Date.now()}`, code:"SAFETY-ESTOP", severity:"CRITICAL", source:"Safety circuit", message:"Emergency stop latched — motion and simulated outputs inhibited", raisedAt:clock(), acknowledged:false },...current]);
  },[integrationMode,sendBridgeCommand]);
  const resetSafety = useCallback(() => {
    if(integrationMode === "OPC_UA") { void sendBridgeCommand("resetSafety"); return; }
    setLineStateLocal("STOPPED");
    setAlarms((current) => current.map((alarm) => alarm.code === "SAFETY-ESTOP" ? {...alarm,acknowledged:true} : alarm));
  },[integrationMode,sendBridgeCommand]);
  const acknowledge = useCallback((id:string) => {
    setAlarms((items) => items.map((a) => a.id === id ? {...a,acknowledged:true}:a));
    if (integrationMode === "OPC_UA") void sendBridgeCommand("acknowledge",id);
  },[integrationMode,sendBridgeCommand]);
  const currentProduct = useMemo(() => [...activeProducts].sort((a,b) => b.position-a.position)[0] ?? recentProducts[0], [activeProducts,recentProducts]);
  const liveEvents = useMemo(() => [...activeProducts.flatMap((p) => p.events),...recentProducts.slice(0,3).flatMap((p) => p.events)].sort((a,b) => b.at.localeCompare(a.at)).slice(0,8), [activeProducts,recentProducts]);

  return { lineState,setLineState,activeProducts,recentProducts,alarms,scenario,setScenario,inject,reset,emergencyStop,resetSafety,acknowledge,currentProduct,liveEvents,integrationMode,opcConnected };
}
