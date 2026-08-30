import assert from "node:assert/strict";
import test from "node:test";
import { createPlcEngine } from "../simulator/plc-engine.mjs";

const outcomes = {
  normal: ["ACCEPT", null],
  vision_defect: ["REJECT", "VISION_LABEL_SKEW"],
  barcode_no_read: ["REJECT", "BARCODE_NO_READ"],
  duplicate_serial: ["REJECT", "BARCODE_DUPLICATE"],
  backend_timeout: ["REJECT", "BACKEND_TIMEOUT"],
};

function finish(engine, maxTicks = 240) {
  for (let index = 0; index < maxTicks && engine.snapshot().activeProducts.length; index += 1) engine.tick();
  assert.equal(engine.snapshot().activeProducts.length, 0, "product did not finish within deterministic tick budget");
  return engine.snapshot().recentProducts[0];
}

for (const [scenario, [disposition, reason]] of Object.entries(outcomes)) {
  test(`${scenario} reaches its expected final disposition`, () => {
    const engine = createPlcEngine(undefined, { autoTick:false });
    try {
      assert.equal(engine.inject(scenario), true);
      const product = finish(engine);
      assert.equal(product.scenario, scenario);
      assert.equal(product.disposition, disposition);
      assert.equal(product.reasonCode, reason);
      assert.ok(product.completedAt);
    } finally {
      engine.close();
    }
  });
}

test("stop, emergency latch, safety reset, and restart preserve control semantics", () => {
  const engine = createPlcEngine(undefined, { autoTick:false });
  try {
    engine.inject("normal");
    engine.tick();
    const movingPosition = engine.snapshot().activeProducts[0].position;
    engine.stop(); engine.tick();
    assert.equal(engine.snapshot().activeProducts[0].position, movingPosition);
    engine.emergencyStop(); engine.start();
    assert.equal(engine.snapshot().lineState, "EMERGENCY_STOP");
    engine.resetSafety();
    assert.equal(engine.snapshot().lineState, "STOPPED");
    engine.start(); engine.tick();
    assert.ok(engine.snapshot().activeProducts[0].position > movingPosition);
  } finally {
    engine.close();
  }
});

test("backend timeout raises an acknowledgeable PLC alarm", () => {
  const engine = createPlcEngine(undefined, { autoTick:false });
  try {
    engine.inject("backend_timeout");
    const product = finish(engine);
    const alarm = engine.snapshot().alarms.find((item) => item.code === "COM-BE-500");
    assert.ok(alarm, "backend timeout did not create an alarm");
    assert.equal(alarm.acknowledged, false);
    engine.acknowledgeAlarm(alarm.id);
    assert.equal(engine.snapshot().alarms.find((item) => item.id === alarm.id)?.acknowledged, true);
    assert.equal(product.disposition, "REJECT");
  } finally {
    engine.close();
  }
});
