import assert from "node:assert/strict";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("./dist/server/index.js", templateRoot);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host:"localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status:404 }) }, DB:{} },
    { waitUntil(){}, passThroughOnException(){} },
  );
}

test("renders the FactoryTrace application shell and portfolio metadata", async () => {
  const response=await render();
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/<title>FactoryTrace — PLC Traceability Digital Twin<\/title>/i);
  assert.match(html,/FACTORYTRACE/);
  assert.match(html,/PT NUSA VITA NUTRINDO/);
  assert.match(html,/WO-PKG-260825-042/);
  assert.match(html,/og\.png/);
  assert.doesNotMatch(html,/codex-preview|Your site is taking shape/i);
});
