"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { productSerial, type Alarm, type ProductEvent, type ProductUnit, type Scenario } from "@/lib/domain";
import { seedProducts } from "@/lib/seed-data";

const clock = () => new Intl.DateTimeFormat("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit", fractionalSecondDigits:3, hour12:false, timeZone:"Asia/Jakarta" }).format(new Date());
const iso = () => new Date().toISOString();
const event = (product:ProductUnit, station:string, type:string, title:string, detail:string, tone:ProductEvent["tone"]): ProductEvent => ({ id:`${product.id}-${type}`, at:clock(), station, type, title, detail, tone });

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
    next.events.unshift(event(next,"S04",next.disposition === "REJECT" ? "REJECT_CONFIRMED" : "PRODUCT_ACCEPTED",next.disposition === "REJECT" ? "Reject confirmed" : "Product accepted",next.disposition === "REJECT" ? `${next.reasonCode} · bin sensor confirmed` : "Released to case packing",next.disposition === "REJECT" ? "warn" : "good"));
  }
  if ((next.stage === "accepted" || next.stage === "reject") && next.position >= 104 && !next.completedAt) next.completedAt = iso();
  return next;
}

export function useLineSimulator() {
  const [lineState,setLineState] = useState<"RUNNING"|"STOPPED">("RUNNING");
  const [activeProducts,setActiveProducts] = useState<ProductUnit[]>([]);
  const [recentProducts,setRecentProducts] = useState<ProductUnit[]>(seedProducts);
  const [alarms,setAlarms] = useState<Alarm[]>([]);
  const [scenario,setScenario] = useState<Scenario>("normal");
  const sequence = useRef(1842);

  useEffect(() => {
    fetch("/api/products").then((response) => response.ok ? response.json() : Promise.reject()).then((value:unknown) => {
      const data=value as {products:ProductUnit[]};
      if (!data.products?.length) return;
      setRecentProducts((current) => {
        const merged=[...data.products,...current];
        return merged.filter((product,index) => merged.findIndex((candidate) => candidate.id === product.id) === index).slice(0,24);
      });
      sequence.current=Math.max(sequence.current,...data.products.map((product) => product.sequence+1));
    }).catch(() => undefined);
  },[]);

  useEffect(() => {
    if (lineState !== "RUNNING") return;
    const timer = window.setInterval(() => {
      const completed:ProductUnit[] = [];
      setActiveProducts((current) => current.map((p) => advanceProduct({ ...p, position:p.position+1.25 })).filter((p) => {
        if (p.completedAt) completed.push(p);
        return !p.completedAt;
      }));
      if (completed.length) {
        setRecentProducts((current) => [...completed,...current].slice(0,24));
        completed.forEach((p) => fetch("/api/products", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(p) }).catch(() => undefined));
      }
    },100);
    return () => window.clearInterval(timer);
  },[lineState]);

  const inject = useCallback(() => {
    if (lineState !== "RUNNING") return false;
    const seq = sequence.current++;
    const id = `live-${Date.now()}-${seq}`;
    const serial = scenario === "duplicate_serial" ? seedProducts[0].serial : productSerial(seq);
    const product:ProductUnit = { id, sequence:seq, serial, scenario, position:0, stage:"created", visionResult:"PENDING", barcodeResult:"PENDING", disposition:"PENDING", reasonCode:null, labelOffsetMm:null, capConfidence:null, codeGrade:null, createdAt:iso(), completedAt:null, events:[{ id:`${id}-created`, at:clock(), station:"PLC", type:"TRACKING_CREATED", title:"Tracking record created", detail:`Scenario profile · ${scenario.replaceAll("_"," ")}`, tone:"neutral" }] };
    setActiveProducts((current) => [...current,product]);
    if (scenario === "backend_timeout") window.setTimeout(() => setAlarms((current) => [{ id:`alarm-${Date.now()}`, code:"COM-BE-500", severity:"CRITICAL", source:"Traceability backend", message:"Validation response exceeded 500 ms fail-safe window", raisedAt:clock(), acknowledged:false },...current]),4600);
    return true;
  },[lineState,scenario]);

  const reset = useCallback(() => { setActiveProducts([]); setAlarms([]); setLineState("STOPPED"); },[]);
  const acknowledge = useCallback((id:string) => setAlarms((items) => items.map((a) => a.id === id ? {...a,acknowledged:true}:a)),[]);
  const currentProduct = useMemo(() => [...activeProducts].sort((a,b) => b.position-a.position)[0] ?? recentProducts[0], [activeProducts,recentProducts]);
  const liveEvents = useMemo(() => [...activeProducts.flatMap((p) => p.events),...recentProducts.slice(0,3).flatMap((p) => p.events)].sort((a,b) => b.at.localeCompare(a.at)).slice(0,8), [activeProducts,recentProducts]);

  return { lineState,setLineState,activeProducts,recentProducts,alarms,scenario,setScenario,inject,reset,acknowledge,currentProduct,liveEvents };
}
