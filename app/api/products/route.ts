import { env } from "cloudflare:workers";
import { workOrder, type ProductUnit } from "@/lib/domain";

interface Statement { bind:(...values:unknown[])=>Statement; run:()=>Promise<unknown>; all:<T>()=>Promise<{results:T[]}> }
interface DemoDatabase { prepare:(sql:string)=>Statement; batch:(statements:Statement[])=>Promise<unknown> }
const database = () => (env as unknown as { DB:DemoDatabase }).DB;

async function ensureSchema(db:DemoDatabase) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS product_units (
      id TEXT PRIMARY KEY, serial_number TEXT NOT NULL, sequence_number INTEGER NOT NULL,
      work_order TEXT NOT NULL, batch_number TEXT NOT NULL, scenario TEXT NOT NULL,
      vision_result TEXT NOT NULL, barcode_result TEXT NOT NULL, disposition TEXT NOT NULL,
      reason_code TEXT, label_offset_mm REAL, cap_confidence REAL, code_grade TEXT,
      created_at TEXT NOT NULL, completed_at TEXT NOT NULL, payload TEXT NOT NULL
    )`),
    // A duplicate serial is itself a traceability observation. Keep every unit
    // record and index the serial for lookup instead of replacing the original.
    db.prepare("DROP INDEX IF EXISTS idx_product_units_serial"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_product_units_serial ON product_units(serial_number)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_product_units_sequence ON product_units(sequence_number)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS product_events (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, event_type TEXT NOT NULL,
      station TEXT NOT NULL, occurred_at TEXT NOT NULL, detail TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_product_events_product_id ON product_events(product_id)"),
  ]);
}

export async function GET() {
  const db=database(); await ensureSchema(db);
  const rows=await db.prepare("SELECT payload FROM product_units ORDER BY completed_at DESC LIMIT 24").all<{payload:string}>();
  return Response.json({ products:rows.results.map((row)=>JSON.parse(row.payload) as ProductUnit) });
}

export async function POST(request:Request) {
  const product=await request.json() as ProductUnit;
  if (!product.id || !product.serial || !product.completedAt) return Response.json({error:"Completed product is required"},{status:400});
  const db=database(); await ensureSchema(db);
  const productInsert=db.prepare(`INSERT OR REPLACE INTO product_units
    (id,serial_number,sequence_number,work_order,batch_number,scenario,vision_result,barcode_result,disposition,reason_code,label_offset_mm,cap_confidence,code_grade,created_at,completed_at,payload)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(product.id,product.serial,product.sequence,workOrder.orderNumber,workOrder.batch,product.scenario,product.visionResult,product.barcodeResult,product.disposition,product.reasonCode,product.labelOffsetMm,product.capConfidence,product.codeGrade,product.createdAt,product.completedAt,JSON.stringify(product));
  const events=product.events.map((item)=>db.prepare("INSERT OR REPLACE INTO product_events (id,product_id,event_type,station,occurred_at,detail) VALUES (?,?,?,?,?,?)").bind(item.id,product.id,item.type,item.station,item.at,item.detail));
  await db.batch([productInsert,...events]);
  return Response.json({ok:true},{status:201});
}
