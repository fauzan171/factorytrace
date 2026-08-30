# PRD — FactoryTrace

## 1. Summary

FactoryTrace adalah demonstrator digital twin berbasis web untuk satu lini pengemasan suplemen kesehatan. Aplikasi memperlihatkan hubungan antara PLC, vision sensor, barcode reader, backend traceability, dan reject station melalui simulasi 3D yang berjalan hampir seperti lini produksi nyata.

Produk ini dibuat sebagai portofolio teknis dan alat presentasi kepada calon klien manufaktur. Semua perusahaan, produk, nomor izin, dan data produksi di dalam demonstrasi bersifat fiktif, tetapi format serta alur kerjanya dibuat menyerupai praktik industri.

## 2. Contacts

| Nama | Peran | Tanggung jawab |
|---|---|---|
| Fauzan | Product owner & system integrator | Arah produk, demo klien, dan integrasi |
| Engineering demo team | PLC/backend/frontend | Simulator PLC, API, database, dan antarmuka |
| Raka Pratama | Persona: Production Supervisor | Memantau target dan kondisi line |
| Siti Rahma | Persona: Quality Control Lead | Menelusuri produk dan penyebab reject |

## 3. Background

### Masalah

Calon klien manufaktur sering sulit membayangkan integrasi software dengan PLC jika presentasi hanya berisi diagram arsitektur. Mereka perlu melihat produk bergerak, diperiksa, divalidasi, ditolak, dan ditelusuri dalam satu alur yang konkret.

Demo hardware asli membutuhkan PLC, conveyor, kamera, barcode reader, jaringan OT, dan area instalasi. Biaya serta akses perangkat membuat demo awal sulit dilakukan. FactoryTrace menggantikan perangkat lapangan dengan simulator, tetapi mempertahankan batas tanggung jawab yang benar:

- PLC menjalankan sequence, interlock, tracking posisi, dan actuator.
- Backend menangani production order, validasi serial, histori, dan pencarian traceability.
- Website menampilkan digital twin, kondisi line, alarm, dan perjalanan produk.

### Konteks pabrik simulasi

| Field | Nilai |
|---|---|
| Perusahaan | PT Nusa Vita Nutrindo (fiktif) |
| Lokasi | Kawasan Industri Cikarang, Jawa Barat |
| Area | Secondary Packaging Hall |
| Line | PKG-02 — Bottle Serialization Line |
| Shift | Shift 2, 14:00–22:00 WIB |
| Produk | VITANUSA Immuno C+Zinc, 30 kaplet |
| SKU | VNZ-CZ30-ID |
| Work order | WO-PKG-260825-042 |
| Batch | NV260825A |
| Tanggal produksi | 25 Agustus 2026 |
| Kedaluwarsa | Agustus 2028 |
| Target order | 4.800 botol |
| Kecepatan nominal | 30 botol/menit |

Nomor serial contoh mengikuti pola internal demo:

`NVN-CZ30-260825-0001842`

Nomor tersebut bukan GTIN, nomor BPOM, atau kode resmi dunia nyata.

## 4. Objective

### Tujuan utama

Membuat demo yang membuat calon klien memahami, dalam waktu kurang dari lima menit, bagaimana sistem traceability berkomunikasi dengan PLC dan menangani produk baik maupun cacat.

### Nilai bagi pengguna

- Production supervisor melihat status line dan progres order secara langsung.
- QC dapat menemukan satu serial dan melihat seluruh hasil inspeksinya.
- System integrator dapat menjelaskan batas antara kontrol PLC dan business logic backend.
- Calon klien dapat mencoba failure scenario tanpa perangkat fisik.

### Key results

1. Pengguna dapat menjalankan skenario normal, vision defect, duplicate serial, no-read, dan backend timeout dari satu layar.
2. Perubahan status produk muncul pada digital twin dan event stream dengan jeda visual di bawah satu detik pada perangkat demo.
3. Setiap produk selesai memiliki serial, batch, hasil vision, hasil barcode, keputusan akhir, dan event timeline.
4. Produk reject hanya didorong ketika produk tersebut mencapai reject station, bukan saat fault pertama kali ditemukan.
5. Pengguna dapat menemukan dan memutar ulang perjalanan produk selesai dalam maksimal tiga interaksi.
6. Aplikasi dapat dibangun untuk deployment tanpa error dan tetap dapat digunakan pada layar laptop serta tablet.

## 5. Market Segments

### Primary segment

System integrator dan software consultant yang perlu memperlihatkan kemampuan integrasi OT/IT sebelum mendapat akses ke line produksi klien.

Job to be done:

> Ketika saya mempresentasikan solusi traceability, saya ingin calon klien melihat alur mesin yang nyata agar mereka memahami solusi dan percaya bahwa integrasinya dapat dilaksanakan.

### Secondary segments

- Production manager yang mengevaluasi digitalization proposal.
- Quality assurance yang membutuhkan unit-level genealogy dan recall evidence.
- Engineering manager yang ingin memahami aliran data PLC ke sistem tingkat atas.
- Recruiter teknis yang menilai kompetensi industrial software kandidat.

### Constraints

- Demo tidak boleh mengaku sebagai safety system atau pengganti commissioning hardware.
- Format protokol device proprietary tidak diklaim identik dengan hardware Keyence.
- Semua aksi berbahaya tetap dimodelkan sebagai keputusan PLC, bukan perintah langsung browser.
- Data perusahaan dan regulasi harus jelas diberi label fiktif.

## 6. Value Propositions

### Untuk calon klien

- Memahami solusi melalui simulasi visual, bukan hanya slide.
- Melihat bagaimana reject tracking mencegah produk yang salah dikeluarkan.
- Melihat bukti traceability per serial sampai tingkat event.
- Menguji fault tanpa menghentikan line nyata.

### Untuk system integrator

- Satu demo untuk menjelaskan PLC sequencing, OPC UA, backend, database, dan UI.
- Adapter simulator dapat diganti dengan OPC UA PLC sebenarnya di tahap implementasi.
- Skenario demo dapat diulang dengan hasil yang konsisten.

### Diferensiasi

FactoryTrace menggabungkan tiga hal yang biasanya terpisah: digital twin 3D, state machine PLC, dan product genealogy. Dashboard biasa hanya menunjukkan angka; FactoryTrace memperlihatkan alasan di balik angka tersebut.

## 7. Solution

### 7.1 UX dan user flow

#### Navigation

Empat area utama berada dalam satu application shell:

1. **Live Line** — digital twin, control, KPI, current product, dan event feed.
2. **Trace Explorer** — pencarian serial dan product journey replay.
3. **Quality & Alarms** — distribusi reject, alarm aktif, dan acknowledgment.
4. **System Map** — penjelasan koneksi device, PLC, OPC UA, backend, dan database.

#### Primary demo flow

```text
Pilih skenario produk
→ Inject product
→ Entry sensor aktif
→ PLC tracking ID dibuat
→ Vision inspection
→ Barcode read dan backend validation
→ PLC menetapkan disposition
→ Produk tiba di reject station
→ Pass atau reject dikonfirmasi
→ Event dan genealogy tersimpan
```

#### Main dashboard wireframe

```text
┌───────────────────────────────────────────────────────────────┐
│ FactoryTrace | PKG-02 | AUTO · RUNNING | OPC UA CONNECTED    │
├───────────────────────────────────────┬───────────────────────┤
│                                       │ Work Order            │
│         THREE.JS DIGITAL TWIN         │ WO-PKG-260825-042     │
│  Entry → Vision → Barcode → Reject   │ Progress 3,427/4,800  │
│                                       │ Shift 2 · Cikarang    │
├───────────────────────────┬───────────┴───────────────────────┤
│ KPI cards                 │ Current Product / live events     │
├───────────────────────────┴───────────────────────────────────┤
│ Start · Stop · Reset | Scenario selector | Inject product    │
└───────────────────────────────────────────────────────────────┘
```

### 7.2 Key features

#### A. Three.js digital twin

- Isometric 3D packaging line with conveyor, bottles, inspection arches, sensors, reject pusher, reject bin, and accepted lane.
- Product color and indicator lights reflect state.
- Camera presets: overview, inspection, and reject station.
- Mouse orbit is limited so users cannot lose the line from view.
- Reduced-motion mode keeps the app accessible.

#### B. PLC simulation engine

- Modes: STOPPED, STARTING, RUNNING, STOPPING, FAULTED.
- Product state machine: CREATED, ENTRY, VISION, BARCODE, DECIDED, REJECTED/ACCEPTED.
- FIFO/product-position tracking ensures the correct bottle is rejected.
- Interlocks: emergency-stop status, guard door, air pressure, motor health, and backend heartbeat.
- Timers for sensor dwell, inspection, validation, reject pulse, and timeout.
- Browser sends requests; simulator decides whether request is allowed.

#### C. Inspection and serialization

- Vision checks: cap presence, label presence, label alignment, and printed lot readability.
- Barcode checks: successful read, expected format, work-order match, and duplicate serial.
- Five deterministic scenarios: normal, vision defect, barcode no-read, duplicate serial, backend timeout.
- Final disposition reason is explicit and auditable.

#### D. Live operations

- Start, controlled stop, reset, and inject product.
- Live counters: total, accepted, rejected, pass rate, and current throughput.
- Active work order and shift context.
- Connection health for PLC/OPC UA, vision, barcode, and database.
- Timestamped live event stream.

#### E. Trace Explorer and replay

- Search by full serial or recent-product list.
- Genealogy detail contains order, batch, timestamps, inspection measurements, result, and reject confirmation.
- Journey replay reconstructs station-to-station movement from persisted events.
- Replay is visibly labelled historical so it cannot be confused with a live product.

#### F. Quality and alarms

- Pareto-style distribution of rejection reasons.
- Active and resolved alarm list.
- Alarm acknowledgment is recorded as an operator action.
- Fault injection creates real state changes rather than decorative toast messages.

#### G. System map

- IV3 and SR-1000 connect to the PLC simulation through modeled industrial interfaces.
- PLC exposes structured tags as an OPC UA Server.
- Traceability backend acts as OPC UA Client.
- Browser communicates only with the backend using HTTP/WebSocket concepts.
- The page clearly distinguishes simulated interfaces from a production deployment.

### 7.3 Data model

#### Work order

- `id`, `order_number`, `sku`, `product_name`
- `batch_number`, `manufactured_on`, `expires_on`
- `target_quantity`, `nominal_rate`, `status`

#### Product unit

- `id`, `serial_number`, `work_order_id`, `sequence_number`
- `line_id`, `shift_code`, `created_at`, `completed_at`
- `vision_status`, `barcode_status`, `final_disposition`, `reason_code`

#### Inspection result

- `product_id`, `station`, `result`, `measured_at`
- `label_offset_mm`, `cap_confidence`, `code_grade`, `processing_ms`

#### Product event

- `product_id`, `event_type`, `station`, `message`, `occurred_at`
- Events are append-only in the demo model.

#### Alarm

- `code`, `severity`, `source`, `message`
- `raised_at`, `acknowledged_at`, `cleared_at`

### 7.4 Technology

| Area | Choice |
|---|---|
| UI | React, TypeScript, responsive CSS |
| 3D | Three.js melalui React Three Fiber |
| Real-time simulation | Standalone Node.js PLC behavior model locally; deterministic client fallback when hosted |
| Production integration boundary | `node-opcua` Server + backend Client Session/Subscription + HTTP/SSE bridge |
| Persistence | Cloudflare D1-compatible SQLite schema |
| Deployment | Cloudflare-compatible Sites build |

Untuk demo hosted, simulator berjalan di application runtime agar dapat dicoba tanpa service lokal tambahan. Untuk demo lokal, `npm run dev:opcua` menjalankan PLC behavior simulator sebagai OPC UA Server di loopback, backend bridge sebagai OPC UA Client, dan web app sebagai consumer HTTP/SSE. Implementasi ini bukan emulator firmware atau ladder Keyence KV-8000.

### 7.5 Tag model

Namespace OPC UA lokal yang diimplementasikan:

```text
FactoryTrace/PKG02/Line/Mode
FactoryTrace/PKG02/Line/State
FactoryTrace/PKG02/Line/SpeedActual
FactoryTrace/PKG02/Line/Heartbeat
FactoryTrace/PKG02/Order/Number
FactoryTrace/PKG02/Order/Batch
FactoryTrace/PKG02/Product/Sequence
FactoryTrace/PKG02/Product/Serial
FactoryTrace/PKG02/Product/VisionResult
FactoryTrace/PKG02/Product/BarcodeResult
FactoryTrace/PKG02/Product/Disposition
FactoryTrace/PKG02/Command/StartRequest
FactoryTrace/PKG02/Command/StopRequest
FactoryTrace/PKG02/Command/ResetRequest
```

### 7.6 Assumptions

- Exact Keyence tag configuration, firmware behavior, and proprietary payload must divalidasi saat hardware tersedia.
- Vision score dan barcode grade pada demo adalah nilai simulasi yang masuk akal, bukan hasil metrologi bersertifikat.
- Produk bergerak pada indexed/controlled conveyor model agar sequence mudah dipahami calon klien.
- Reject confirmation sensor tersedia setelah reject pusher.
- Produk demo telah memperoleh serialized label sebelum mencapai barcode station.
- Hosted demo tidak mengendalikan hardware fisik.

## 8. Release

### Release 1 — Portfolio demonstrator

- One-line 3D digital twin.
- Realistic work order and serialized product data.
- Start, stop, reset, and five injection scenarios.
- Vision, barcode validation, correct-product reject tracking.
- Live event stream, counters, trace search, and replay.
- Quality summary, alarms, and system architecture map.
- Responsive layout and deployable build.

### Release 1.1 — Integration readiness

- Local OPC UA Server, Client Subscription, and writable command tag contract.
- Configurable endpoint and certificate setup.
- Recorded payload playback from a real PLC session.
- CSV genealogy export and richer alarm acknowledgment.

### Future, outside current scope

- Real Keyence commissioning.
- Multi-line and multi-site tenancy.
- ERP/MES connector.
- Regulated electronic signature workflow.
- Full OEE availability/performance/quality calculation.
- Predictive maintenance and machine-learning inspection.

### Acceptance criteria

Release 1 dianggap selesai jika:

1. Satu produk normal dapat bergerak dari entry sampai accepted output.
2. Produk dengan vision defect atau invalid barcode ditolak pada reject station yang tepat.
3. Duplicate serial divalidasi melalui business logic, bukan random visual state.
4. Backend timeout menghasilkan alarm dan disposition sesuai fail-safe demo rule.
5. Product trace menampilkan histori lengkap dan replay sinkron dengan event.
6. Semua tombol utama bekerja dengan mouse dan keyboard.
7. Tampilan dapat digunakan pada desktop dan tablet tanpa konten utama terpotong.
8. Production build berhasil tanpa error.
