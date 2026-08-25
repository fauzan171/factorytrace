import type { ProductUnit } from "./domain";

function seedProduct(sequence: number, disposition: "ACCEPT" | "REJECT", reasonCode: string | null, minute: string): ProductUnit {
  const serial = `NVN-CZ30-260825-${String(sequence).padStart(7, "0")}`;
  const rejected = disposition === "REJECT";
  return {
    id: `seed-${sequence}`,
    sequence,
    serial,
    scenario: reasonCode === "VISION_LABEL_SKEW" ? "vision_defect" : reasonCode === "BARCODE_DUPLICATE" ? "duplicate_serial" : reasonCode === "BARCODE_NO_READ" ? "barcode_no_read" : "normal",
    position: 112,
    stage: rejected ? "reject" : "accepted",
    visionResult: reasonCode === "VISION_LABEL_SKEW" ? "FAIL" : "PASS",
    barcodeResult: reasonCode?.startsWith("BARCODE") ? "FAIL" : "PASS",
    disposition,
    reasonCode,
    labelOffsetMm: reasonCode === "VISION_LABEL_SKEW" ? 4.8 : 0.4,
    capConfidence: 99.2,
    codeGrade: reasonCode?.startsWith("BARCODE") ? null : "A",
    createdAt: `2026-08-25T15:${minute}:04+07:00`,
    completedAt: `2026-08-25T15:${minute}:12+07:00`,
    events: [
      { id:`${sequence}-1`, at:`15:${minute}:04.102`, station:"S01", type:"PRODUCT_ENTERED", title:"Product entered", detail:`Tracking sequence ${String(sequence).padStart(5,"0")} allocated`, tone:"neutral" },
      { id:`${sequence}-2`, at:`15:${minute}:06.284`, station:"S02", type:"VISION_COMPLETED", title:`Vision ${reasonCode === "VISION_LABEL_SKEW" ? "FAIL" : "PASS"}`, detail:reasonCode === "VISION_LABEL_SKEW" ? "Label offset +4.8 mm exceeds ±2.0 mm" : "Label offset +0.4 mm · cap confidence 99.2%", tone:reasonCode === "VISION_LABEL_SKEW" ? "bad" : "good" },
      { id:`${sequence}-3`, at:`15:${minute}:08.512`, station:"S03", type:"BARCODE_COMPLETED", title:reasonCode === "BARCODE_DUPLICATE" ? "Duplicate serial" : reasonCode === "BARCODE_NO_READ" ? "Barcode no-read" : "Serial validated", detail:reasonCode === "BARCODE_DUPLICATE" ? "Serial already commissioned at 14:51:22" : reasonCode === "BARCODE_NO_READ" ? "Decode attempt exceeded 450 ms" : `${serial} · Grade A`, tone:reasonCode?.startsWith("BARCODE") ? "bad" : "good" },
      { id:`${sequence}-4`, at:`15:${minute}:11.901`, station:"S04", type:rejected ? "REJECT_CONFIRMED" : "PRODUCT_ACCEPTED", title:rejected ? "Reject confirmed" : "Product accepted", detail:rejected ? `${reasonCode} · bin sensor confirmed` : "Released to case packing", tone:rejected ? "warn" : "good" },
    ],
  };
}

export const seedProducts: ProductUnit[] = [
  seedProduct(1841, "REJECT", "BARCODE_DUPLICATE", "41"),
  seedProduct(1840, "ACCEPT", null, "39"),
  seedProduct(1839, "REJECT", "VISION_LABEL_SKEW", "37"),
  seedProduct(1838, "ACCEPT", null, "35"),
  seedProduct(1837, "REJECT", "BARCODE_NO_READ", "33"),
  seedProduct(1836, "ACCEPT", null, "31"),
];
