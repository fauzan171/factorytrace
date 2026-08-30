import { spawn } from "node:child_process";

const children=[];
const timers=[];
let stopping=false;
const run=(label,command,args) => {
  const child=spawn(command,args,{stdio:["inherit","pipe","pipe"],env:process.env});
  child.stdout.on("data",data=>process.stdout.write(`[${label}] ${data}`));
  child.stderr.on("data",data=>process.stderr.write(`[${label}] ${data}`));
  child.once("exit",(code,signal) => {
    if (stopping || code === 0) return;
    process.stderr.write(`[${label}] exited unexpectedly (${signal ?? `code ${code}`}); stopping local stack.\n`);
    shutdown(code ?? 1);
  });
  children.push(child); return child;
};
run("PLC","node",["simulator/opcua-server.mjs"]);
timers.push(setTimeout(()=>run("BRIDGE","node",["simulator/opcua-bridge.mjs"]),1200));
timers.push(setTimeout(()=>run("WEB","npm",["run","dev","--","-H","127.0.0.1","-p","3000"]),2200));
function shutdown(exitCode=0) {
  if (stopping) return;
  stopping=true;
  for (const timer of timers) clearTimeout(timer);
  for (const child of children) child.kill("SIGTERM");
  setTimeout(()=>process.exit(exitCode),700);
}
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
