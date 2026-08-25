export type Scenario = "normal" | "vision_defect" | "barcode_no_read" | "duplicate_serial" | "backend_timeout";
export type ProductStage = "created" | "entry" | "vision" | "barcode" | "decision" | "reject" | "accepted";
export type Result = "PENDING" | "PASS" | "FAIL" | "TIMEOUT";

export interface ProductEvent {
  id: string;
  at: string;
  station: string;
  type: string;
  title: string;
  detail: string;
  tone: "neutral" | "good" | "warn" | "bad";
}

export interface ProductUnit {
  id: string;
  sequence: number;
  serial: string;
  scenario: Scenario;
  position: number;
  stage: ProductStage;
  visionResult: Result;
  barcodeResult: Result;
  disposition: "PENDING" | "ACCEPT" | "REJECT";
  reasonCode: string | null;
  labelOffsetMm: number | null;
  capConfidence: number | null;
  codeGrade: string | null;
  createdAt: string;
  completedAt: string | null;
  events: ProductEvent[];
}

export interface Alarm {
  id: string;
  code: string;
  severity: "WARNING" | "CRITICAL";
  source: string;
  message: string;
  raisedAt: string;
  acknowledged: boolean;
}

export const scenarioLabels: Record<Scenario, string> = {
  normal: "Normal product",
  vision_defect: "Vision · label skew",
  barcode_no_read: "Barcode · no read",
  duplicate_serial: "Barcode · duplicate serial",
  backend_timeout: "Backend · validation timeout",
};

export const workOrder = {
  company: "PT Nusa Vita Nutrindo",
  plant: "Cikarang Plant",
  area: "Secondary Packaging Hall",
  line: "PKG-02",
  orderNumber: "WO-PKG-260825-042",
  sku: "VNZ-CZ30-ID",
  productName: "VITANUSA Immuno C+Zinc",
  packaging: "30 kaplet · Botol HDPE putih · Serialized QR",
  batch: "NV260825A",
  manufactured: "25 AUG 2026",
  expiry: "AUG 2028",
  target: 4800,
  nominalRate: 30,
  shift: "Shift 2 · 14:00—22:00 WIB",
  supervisor: "Raka Pratama",
};

export function productSerial(sequence: number) {
  return `NVN-CZ30-260825-${String(sequence).padStart(7, "0")}`;
}
