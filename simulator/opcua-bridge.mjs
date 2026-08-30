import http from "node:http";
import { OPCUAClient, AttributeIds, ClientSubscription, ClientMonitoredItem, DataType, MessageSecurityMode, SecurityPolicy, TimestampsToReturn, Variant } from "node-opcua";

const endpointUrl="opc.tcp://127.0.0.1:4840/FactoryTrace";
const client=OPCUAClient.create({applicationName:"FactoryTrace Backend Bridge",endpointMustExist:false,securityMode:MessageSecurityMode.None,securityPolicy:SecurityPolicy.None,connectionStrategy:{initialDelay:500,maxDelay:2000,maxRetry:20}});
await client.connect(endpointUrl);
const session=await client.createSession();
let snapshot={source:"OPC_UA_BRIDGE",lineState:"STOPPED",activeProducts:[],recentProducts:[],alarms:[]};
const sseClients=new Set();
const broadcast=() => { const payload=`data: ${JSON.stringify(snapshot)}\n\n`; for (const response of sseClients) response.write(payload); };

const subscription=ClientSubscription.create(session,{requestedPublishingInterval:100,requestedLifetimeCount:600,requestedMaxKeepAliveCount:20,maxNotificationsPerPublish:20,publishingEnabled:true,priority:1});
const monitoredItem=ClientMonitoredItem.create(subscription,{nodeId:"ns=1;s=FactoryTrace/PKG02/SnapshotJson",attributeId:AttributeIds.Value},{samplingInterval:100,discardOldest:true,queueSize:1},TimestampsToReturn.Both);
monitoredItem.on("changed",(dataValue) => { try { snapshot=JSON.parse(dataValue.value.value); broadcast(); } catch { /* Ignore an incomplete sample and wait for the next publish. */ } });

const commandNodes={start:["StartRequest",DataType.Boolean,true],stop:["StopRequest",DataType.Boolean,true],emergency:["EmergencyStopRequest",DataType.Boolean,true],resetSafety:["ResetSafetyRequest",DataType.Boolean,true],reset:["ResetSimulationRequest",DataType.Boolean,true],inject:["InjectScenario",DataType.String,null],acknowledge:["AcknowledgeAlarm",DataType.String,null]};
async function writeCommand(command,value) {
  const definition=commandNodes[command]; if(!definition) throw new Error("Unknown command");
  const [name,dataType,defaultValue]=definition;
  const status=await session.write({nodeId:`ns=1;s=FactoryTrace/PKG02/Command/${name}`,attributeId:AttributeIds.Value,value:{value:new Variant({dataType,value:defaultValue??value})}});
  return status.toString();
}

const cors={"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type","cache-control":"no-store"};
const server=http.createServer((request,response) => {
  if(request.method==="OPTIONS"){response.writeHead(204,cors);response.end();return;}
  if(request.method==="GET"&&request.url==="/health"){response.writeHead(200,{...cors,"content-type":"application/json"});response.end(JSON.stringify({connected:true,transport:"OPC UA subscription",endpointUrl,publishingIntervalMs:100}));return;}
  if(request.method==="GET"&&request.url==="/api/snapshot"){response.writeHead(200,{...cors,"content-type":"application/json"});response.end(JSON.stringify(snapshot));return;}
  if(request.method==="GET"&&request.url==="/api/events"){response.writeHead(200,{...cors,"content-type":"text/event-stream","connection":"keep-alive"});response.write(`data: ${JSON.stringify(snapshot)}\n\n`);sseClients.add(response);request.on("close",()=>sseClients.delete(response));return;}
  if(request.method==="POST"&&request.url==="/api/command"){
    let body=""; request.on("data",chunk=>body+=chunk); request.on("end",async()=>{try{const payload=JSON.parse(body);const status=await writeCommand(payload.command,payload.value);response.writeHead(200,{...cors,"content-type":"application/json"});response.end(JSON.stringify({ok:true,status}));}catch(error){response.writeHead(400,{...cors,"content-type":"application/json"});response.end(JSON.stringify({ok:false,error:error.message}));}});return;
  }
  response.writeHead(404,cors);response.end();
});
server.listen(4001,"127.0.0.1",()=>console.log(`[BACKEND] OPC UA Client bridge: http://127.0.0.1:4001 → ${endpointUrl}`));

const shutdown=async()=>{for(const response of sseClients)response.end();server.close();await subscription.terminate();await session.close();await client.disconnect();process.exit(0);};
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
