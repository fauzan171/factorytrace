import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sceneSource = await readFile(new URL("../components/FactoryScene.tsx", import.meta.url), "utf8");

test("imperatively animated reject parts are not reset by React snapshot renders", () => {
  assert.doesNotMatch(sceneSource, /ref=\{ref\}\s+position=\{\[x,y,z\]\}/, "bottle position is reset every OPC UA render");
  assert.doesNotMatch(sceneSource, /ref=\{paddle\}\s+position=/, "paddle has a declarative position that resets every OPC UA render");
  assert.doesNotMatch(sceneSource, /ref=\{rod\}\s+position=/, "rod has a declarative position that resets every OPC UA render");
});

test("reject actuator is driven from the product reject stage", () => {
  assert.match(sceneSource, /p\.stage==="reject"/, "actuator must only run after PLC enters reject stage");
});
