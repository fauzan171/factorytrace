const scenarioReason = {
  vision_defect: "VISION_LABEL_SKEW",
  barcode_no_read: "BARCODE_NO_READ",
  duplicate_serial: "BARCODE_DUPLICATE",
  backend_timeout: "BACKEND_TIMEOUT",
};

const clock = () => new Intl.DateTimeFormat("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit", fractionalSecondDigits:3, hour12:false, timeZone:"Asia/Jakarta" }).format(new Date());
const serial = (sequence) => `NVN-CZ30-260825-${String(sequence).padStart(7,"0")}`;

function makeEvent(product, station, type, title, detail, tone="neutral") {
  return { id:`${product.id}-${type}`, at:clock(), station, type, title, detail, tone };
}

export function createPlcEngine(onChange = () => {}, options = {}) {
  const { autoTick = true, tickIntervalMs = 100 } = options;
  let sequence = 1842;
  let lineState = "RUNNING";
  let scenario = "normal";
  let activeProducts = [];
  let recentProducts = [];
  let alarms = [];

  function emit() { onChange(snapshot()); }
  function snapshot() {
    return { source:"OPC_UA_PLC_SIMULATOR", generatedAt:new Date().toISOString(), lineState, scenario, activeProducts, recentProducts, alarms };
  }
  function setScenario(value) { scenario = value; emit(); }
  function start() { if (lineState !== "EMERGENCY_STOP") lineState = "RUNNING"; emit(); }
  function stop() { if (lineState !== "EMERGENCY_STOP") lineState = "STOPPED"; emit(); }
  function emergencyStop() {
    lineState = "EMERGENCY_STOP";
    if (!alarms.some((alarm) => alarm.code === "SAFETY-ESTOP" && !alarm.acknowledged)) alarms.unshift({ id:`alarm-estop-${Date.now()}`, code:"SAFETY-ESTOP", severity:"CRITICAL", source:"PLC safety input", message:"Emergency stop latched — simulated motion outputs inhibited", raisedAt:clock(), acknowledged:false });
    emit();
  }
  function resetSafety() {
    if (lineState === "EMERGENCY_STOP") lineState = "STOPPED";
    alarms = alarms.map((alarm) => alarm.code === "SAFETY-ESTOP" ? {...alarm,acknowledged:true} : alarm);
    emit();
  }
  function acknowledgeAlarm(id) {
    alarms = alarms.map((alarm) => alarm.id === id ? { ...alarm, acknowledged:true } : alarm);
    emit();
  }
  function resetSimulation() { activeProducts = []; alarms = []; scenario = "normal"; lineState = "STOPPED"; emit(); }
  function inject(requestedScenario = scenario) {
    if (lineState !== "RUNNING") return false;
    const seq = sequence++;
    const id = `plc-${Date.now()}-${seq}`;
    const product = { id, sequence:seq, serial:requestedScenario === "duplicate_serial" ? "NVN-CZ30-260825-0001837" : serial(seq), scenario:requestedScenario, position:0, stage:"created", visionResult:"PENDING", barcodeResult:"PENDING", disposition:"PENDING", reasonCode:null, labelOffsetMm:null, capConfidence:null, codeGrade:null, createdAt:new Date().toISOString(), completedAt:null, events:[] };
    product.events.unshift(makeEvent(product,"PLC","TRACKING_CREATED","Tracking record created",`OPC UA simulator scenario · ${requestedScenario.replaceAll("_"," ")}`));
    activeProducts.push(product);
    // Fault selection is a one-shot profile for the next product. Returning to
    // normal prevents an injected test defect from contaminating later units.
    scenario = "normal";
    emit();
    return true;
  }

  function advance(product) {
    const next = {...product,events:[...product.events]};
    const increment = next.stage === "reject" ? .5 : 1.25;
    next.position += increment;
    if (next.stage === "created" && next.position >= 8) { next.stage="entry"; next.events.unshift(makeEvent(next,"S01","PRODUCT_ENTERED","Product entered",`Sequence ${next.sequence} allocated`)); }
    if (next.stage === "entry" && next.position >= 32) {
      next.stage="vision"; const failed=next.scenario === "vision_defect"; next.visionResult=failed?"FAIL":"PASS"; next.labelOffsetMm=failed?4.8:.4; next.capConfidence=failed?97.1:99.2;
      next.events.unshift(makeEvent(next,"S02","VISION_COMPLETED",`Vision ${next.visionResult}`,failed?"Label offset +4.8 mm exceeds ±2.0 mm":"Label offset +0.4 mm · cap confidence 99.2%",failed?"bad":"good"));
    }
    if (next.stage === "vision" && next.position >= 55) {
      next.stage="barcode";
      if (next.scenario === "barcode_no_read") { next.barcodeResult="FAIL"; next.events.unshift(makeEvent(next,"S03","BARCODE_NO_READ","Barcode no-read","Decode exceeded 450 ms","bad")); }
      else if (next.scenario === "duplicate_serial") { next.barcodeResult="FAIL"; next.codeGrade="A"; next.events.unshift(makeEvent(next,"S03","BARCODE_DUPLICATE","Duplicate serial","Serial already commissioned","bad")); }
      else if (next.scenario === "backend_timeout") {
        next.barcodeResult="TIMEOUT"; next.codeGrade="A";
        next.events.unshift(makeEvent(next,"S03","VALIDATION_TIMEOUT","Backend validation timeout","No response in 500 ms fail-safe window","bad"));
        const alarmId = `alarm-${next.id}-backend`;
        if (!alarms.some((alarm) => alarm.id === alarmId)) alarms.unshift({ id:alarmId, code:"COM-BE-500", severity:"CRITICAL", source:"Traceability backend", message:"Validation response exceeded 500 ms fail-safe window", raisedAt:clock(), acknowledged:false });
      }
      else { next.barcodeResult="PASS"; next.codeGrade="A"; next.events.unshift(makeEvent(next,"S03","BARCODE_VALIDATED","Serial validated",`${next.serial} · Grade A`,"good")); }
    }
    if (next.stage === "barcode" && next.position >= 66) { next.stage="decision"; next.reasonCode=scenarioReason[next.scenario]??null; next.disposition=next.reasonCode?"REJECT":"ACCEPT"; next.events.unshift(makeEvent(next,"PLC","DISPOSITION_SET",`Disposition ${next.disposition}`,next.reasonCode??"All quality gates passed",next.disposition==="ACCEPT"?"good":"warn")); }
    if (next.stage === "decision" && next.position >= 82) { next.stage=next.disposition==="REJECT"?"reject":"accepted"; next.events.unshift(makeEvent(next,"S04",next.disposition==="REJECT"?"REJECT_ACTUATED":"PRODUCT_ACCEPTED",next.disposition==="REJECT"?"Reject sequence started":"Product accepted",next.disposition==="REJECT"?"Pneumatic pusher extending":"Released to case packing",next.disposition==="REJECT"?"warn":"good")); }
    if (next.stage === "reject" && next.position >= 100 && !next.events.some((item) => item.type === "REJECT_CONFIRMED")) next.events.unshift(makeEvent(next,"S04","REJECT_CONFIRMED","Reject confirmed",`${next.reasonCode} · bin sensor occupied`,"warn"));
    if ((next.stage === "accepted" || next.stage === "reject") && next.position >= 104) next.completedAt=new Date().toISOString();
    return next;
  }

  function tick() {
    if (lineState !== "RUNNING") return;
    const completed=[];
    activeProducts=activeProducts.map(advance).filter((product) => { if (product.completedAt) completed.push(product); return !product.completedAt; });
    if (completed.length) recentProducts=[...completed,...recentProducts].slice(0,24);
    emit();
  }

  const timer = autoTick ? setInterval(tick,tickIntervalMs) : null;

  return { snapshot, tick, setScenario, start, stop, emergencyStop, resetSafety, acknowledgeAlarm, resetSimulation, inject, close:() => { if (timer) clearInterval(timer); } };
}
