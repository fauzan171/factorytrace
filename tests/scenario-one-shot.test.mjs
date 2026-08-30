import assert from "node:assert/strict";
import test from "node:test";
import { createPlcEngine } from "../simulator/plc-engine.mjs";

test("a fault scenario applies to one injected product and then resets to normal", () => {
  const engine = createPlcEngine();

  try {
    assert.equal(engine.inject("vision_defect"), true);
    assert.equal(engine.snapshot().activeProducts[0].scenario, "vision_defect");
    assert.equal(engine.snapshot().scenario, "normal");

    assert.equal(engine.inject(), true);
    assert.equal(engine.snapshot().activeProducts[1].scenario, "normal");
  } finally {
    engine.close();
  }
});
