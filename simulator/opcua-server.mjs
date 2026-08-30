import { OPCUAServer, Variant, DataType, StatusCodes, MessageSecurityMode, SecurityPolicy } from "node-opcua";
import { createPlcEngine } from "./plc-engine.mjs";

let latest;
const engine=createPlcEngine((snapshot) => { latest=snapshot; });
latest=engine.snapshot();

const server=new OPCUAServer({
  port:4840,
  resourcePath:"/FactoryTrace",
  hostname:"127.0.0.1",
  buildInfo:{productName:"FactoryTrace PLC Simulator",buildNumber:"1",buildDate:new Date()},
  securityModes:[MessageSecurityMode.None],
  securityPolicies:[SecurityPolicy.None],
  allowAnonymous:true,
});

await server.initialize();
const addressSpace=server.engine.addressSpace;
const namespace=addressSpace.getOwnNamespace();
const device=namespace.addObject({organizedBy:addressSpace.rootFolder.objects,browseName:"FactoryTrace PKG-02 PLC",nodeId:"ns=1;s=FactoryTrace/PKG02"});
const node=(name,dataType,getter) => namespace.addVariable({componentOf:device,browseName:name,nodeId:`ns=1;s=FactoryTrace/PKG02/${name.replaceAll(".","/")}`,dataType,value:{get:() => new Variant({dataType,value:getter()})},minimumSamplingInterval:50});
const command=(name,dataType,handler) => namespace.addVariable({componentOf:device,browseName:name,nodeId:`ns=1;s=FactoryTrace/PKG02/${name.replaceAll(".","/")}`,dataType,minimumSamplingInterval:100,value:{get:() => new Variant({dataType,value:dataType===DataType.Boolean?false:""}),set:(variant) => { handler(variant.value); return StatusCodes.Good; }}});
const current=() => latest.activeProducts.toSorted((a,b) => b.position-a.position)[0];

node("Line.State",DataType.String,() => latest.lineState);
node("Line.SpeedActual",DataType.Double,() => latest.lineState === "RUNNING" ? 30.2 : 0);
node("Line.ActiveProductCount",DataType.UInt16,() => latest.activeProducts.length);
node("Order.Number",DataType.String,() => "WO-PKG-260825-042");
node("Product.Sequence",DataType.UInt32,() => current()?.sequence??0);
node("Product.Serial",DataType.String,() => current()?.serial??"");
node("Product.Position",DataType.Double,() => current()?.position??0);
node("Product.VisionResult",DataType.String,() => current()?.visionResult??"PENDING");
node("Product.BarcodeResult",DataType.String,() => current()?.barcodeResult??"PENDING");
node("Product.Disposition",DataType.String,() => current()?.disposition??"PENDING");
node("Safety.EStopLatched",DataType.Boolean,() => latest.lineState === "EMERGENCY_STOP");
node("SnapshotJson",DataType.String,() => JSON.stringify(latest));
command("Command.StartRequest",DataType.Boolean,(value) => { if(value) engine.start(); });
command("Command.StopRequest",DataType.Boolean,(value) => { if(value) engine.stop(); });
command("Command.EmergencyStopRequest",DataType.Boolean,(value) => { if(value) engine.emergencyStop(); });
command("Command.ResetSafetyRequest",DataType.Boolean,(value) => { if(value) engine.resetSafety(); });
command("Command.ResetSimulationRequest",DataType.Boolean,(value) => { if(value) engine.resetSimulation(); });
command("Command.InjectScenario",DataType.String,(value) => engine.inject(String(value)));
command("Command.AcknowledgeAlarm",DataType.String,(value) => engine.acknowledgeAlarm(String(value)));

await server.start();
console.log(`[PLC SIM] OPC UA server: ${server.getEndpointUrl()}`);
console.log("[PLC SIM] Namespace: ns=1;s=FactoryTrace/PKG02/*");

const shutdown=async() => { engine.close(); await server.shutdown(500); process.exit(0); };
process.on("SIGINT",shutdown); process.on("SIGTERM",shutdown);
