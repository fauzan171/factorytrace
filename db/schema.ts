import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const productUnits = sqliteTable("product_units", {
  id: text("id").primaryKey(),
  serialNumber: text("serial_number").notNull(),
  sequenceNumber: integer("sequence_number").notNull(),
  workOrder: text("work_order").notNull(),
  batchNumber: text("batch_number").notNull(),
  scenario: text("scenario").notNull(),
  visionResult: text("vision_result").notNull(),
  barcodeResult: text("barcode_result").notNull(),
  disposition: text("disposition").notNull(),
  reasonCode: text("reason_code"),
  labelOffsetMm: real("label_offset_mm"),
  capConfidence: real("cap_confidence"),
  codeGrade: text("code_grade"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at").notNull(),
  payload: text("payload").notNull(),
}, (table) => [
  uniqueIndex("idx_product_units_serial").on(table.serialNumber),
  uniqueIndex("idx_product_units_sequence").on(table.sequenceNumber),
]);

export const productEvents = sqliteTable("product_events", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  eventType: text("event_type").notNull(),
  station: text("station").notNull(),
  occurredAt: text("occurred_at").notNull(),
  detail: text("detail").notNull(),
}, (table) => [index("idx_product_events_product_id").on(table.productId)]);
