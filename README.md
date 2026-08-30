# FactoryTrace

FactoryTrace adalah demonstrator **digital twin traceability PLC** untuk lini pengemasan farmasi/suplemen. Proyek ini memperlihatkan satu alur OT/IT utuh: produk bergerak di conveyor 3D, diperiksa oleh vision dan barcode station, dilacak oleh state machine PLC, divalidasi oleh backend, lalu diterima atau ditolak dengan histori per unit yang dapat ditelusuri kembali.

> Seluruh nama perusahaan, produk, nomor serial, work order, batch, dan data yang menyerupai data regulasi di proyek ini bersifat fiktif. FactoryTrace adalah demonstrator portofolio, bukan safety system, pengganti PLC nyata, atau alat commissioning mesin.

## Daftar isi

- [Fitur utama](#fitur-utama)
- [Arsitektur sistem](#arsitektur-sistem)
- [Alur produk](#alur-produk)
- [Teknologi](#teknologi)
- [Persyaratan](#persyaratan)
- [Menjalankan proyek](#menjalankan-proyek)
- [Cara menggunakan demo](#cara-menggunakan-demo)
- [Skenario simulasi](#skenario-simulasi)
- [OPC UA](#opc-ua)
- [API HTTP dan SSE](#api-http-dan-sse)
- [Database dan persistensi](#database-dan-persistensi)
- [Struktur direktori](#struktur-direktori)
- [Perintah npm](#perintah-npm)
- [Pengujian](#pengujian)
- [Deployment](#deployment)
- [Batasan dan keamanan](#batasan-dan-keamanan)
- [Troubleshooting](#troubleshooting)
- [Dokumentasi lanjutan](#dokumentasi-lanjutan)

## Fitur utama

- Digital twin lini pengemasan berbasis Three.js dengan kamera overview, inspection, dan reject.
- Simulator PLC mandiri dengan state machine deterministik dan pelacakan posisi setiap produk.
- OPC UA Server dan OPC UA Client sungguhan menggunakan `node-opcua`.
- Subscription OPC UA 100 ms dan writable command nodes untuk kontrol line.
- Lima skenario produk: normal, vision defect, barcode no-read, duplicate serial, dan backend timeout.
- Reject sequencing berbasis posisi sehingga pusher hanya menolak produk yang sudah ditandai dan benar-benar tiba di reject station.
- Trace Explorer untuk mencari serial, melihat genealogy, dan memutar ulang perjalanan historis produk.
- Quality dashboard, alarm acknowledgement, live event feed, KPI produksi, dan system map.
- Penyimpanan completed-product history dan event ke Cloudflare D1 melalui Drizzle schema.
- Browser-only simulator sebagai fallback ketika OPC UA stack lokal tidak aktif.
- Dukungan reduced-motion dan tampilan responsif untuk laptop maupun tablet.

## Arsitektur sistem

FactoryTrace dapat berjalan dalam dua mode.

### 1. Mode browser-only

Mode ini aktif dengan `npm run dev`. State machine berjalan di React hook pada browser. Mode ini paling sederhana untuk mencoba UI dan tidak membutuhkan koneksi TCP OPC UA.

```text
Browser / React UI
├── Three.js digital twin
├── Browser line simulator
└── /api/products ──> Cloudflare D1 lokal
```

Jika bridge di `127.0.0.1:4001` tidak ditemukan, aplikasi otomatis menggunakan mode ini.

### 2. Mode OPC UA lokal

Mode ini aktif dengan `npm run dev:opcua` dan menjalankan tiga proses:

```text
┌──────────────────────────────┐
│ PLC behavior model           │
│ simulator/plc-engine.mjs     │
└──────────────┬───────────────┘
               │ state/tags
┌──────────────▼───────────────┐
│ OPC UA Server                │
│ opc.tcp://127.0.0.1:4840     │
└──────────────┬───────────────┘
               │ Client Session + Subscription 100 ms
┌──────────────▼───────────────┐
│ HTTP/SSE bridge              │
│ http://127.0.0.1:4001        │
└──────────────┬───────────────┘
               │ SSE snapshot + HTTP commands
┌──────────────▼───────────────┐
│ React UI + Three.js          │
│ http://127.0.0.1:3000        │
└──────────────┬───────────────┘
               │ completed products/events
┌──────────────▼───────────────┐
│ API route + Cloudflare D1    │
└──────────────────────────────┘
```

Browser tidak berkomunikasi langsung dengan endpoint OPC UA. Bridge bertindak sebagai backend OPC UA Client, meneruskan snapshot melalui Server-Sent Events (SSE), dan mengubah command HTTP menjadi write ke OPC UA nodes.

## Alur produk

Setiap unit memiliki ID tracking, sequence, serial, posisi, status inspeksi, disposition, dan event timeline sendiri.

```text
CREATED
  ↓ S01 entry sensor
ENTRY
  ↓ S02 vision inspection
VISION
  ↓ S03 barcode read + backend validation
BARCODE
  ↓ PLC disposition decision
DECISION
  ├── ACCEPTED ──> released to case packing
  └── REJECT ────> S04 pusher ──> reject confirmation
```

Station yang dimodelkan:

| Station | Fungsi |
|---|---|
| `S01` | Mendeteksi produk masuk dan mengalokasikan tracking sequence. |
| `S02` | Memeriksa keberadaan cap, posisi label, dan kualitas visual. |
| `S03` | Membaca barcode/serial dan mensimulasikan validasi backend. |
| `PLC` | Menentukan disposition akhir berdasarkan seluruh quality gate. |
| `S04` | Menjalankan reject pusher atau melepas produk accepted. |

## Teknologi

| Area | Teknologi |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| 3D | Three.js, React Three Fiber, Drei, postprocessing |
| Web runtime | vinext, Vite 8, React Server Components |
| Edge runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite), Drizzle ORM/Kit |
| Industrial protocol | OPC UA melalui `node-opcua` |
| Realtime bridge | HTTP, Server-Sent Events, OPC UA Subscription |
| Testing | Node.js test runner, TypeScript, ESLint, production build |

## Persyaratan

- Node.js **22.13.0 atau lebih baru**.
- npm (mengikuti Node.js installation).
- Port lokal berikut tersedia untuk mode OPC UA:
  - `3000` untuk web application.
  - `4001` untuk HTTP/SSE bridge.
  - `4840` untuk OPC UA Server.
- Browser modern dengan WebGL aktif.

Cek versi runtime:

```bash
node --version
npm --version
```

## Menjalankan proyek

### Instalasi

```bash
git clone https://github.com/fauzan171/factorytrace.git
cd factorytrace
npm install
```

### Opsi A — browser-only

```bash
npm run dev
```

Buka alamat yang ditampilkan terminal. Secara default development server menggunakan port `5173`; jika port tersebut terpakai, Vite dapat memilih port berikutnya.

### Opsi B — simulasi OT/IT lengkap

```bash
npm run dev:opcua
```

Perintah ini menjalankan:

- PLC engine + OPC UA Server di `opc.tcp://127.0.0.1:4840/FactoryTrace`.
- Backend bridge di `http://127.0.0.1:4001`.
- Web application di `http://127.0.0.1:3000`.

Tekan `Ctrl+C` sekali untuk menghentikan seluruh proses anak secara terkoordinasi.

### Menjalankan komponen OPC UA terpisah

Terminal 1:

```bash
npm run plc:server
```

Terminal 2, setelah server siap:

```bash
npm run opcua:bridge
```

Terminal 3:

```bash
npm run dev -- -H 127.0.0.1 -p 3000
```

## Cara menggunakan demo

1. Buka tab **Live Line**.
2. Pastikan line berstatus `RUNNING`.
3. Pilih scenario profile.
4. Klik **Inject product**. Scenario otomatis kembali ke `normal` setelah satu produk agar defect tidak mencemari unit berikutnya.
5. Ikuti produk pada digital twin atau ganti preset kamera.
6. Perhatikan hasil vision, barcode, disposition, event stream, dan reject pusher.
7. Buka **Trace Explorer** untuk mencari produk selesai dan melihat event timeline/replay.
8. Buka **Quality & Alarms** untuk memeriksa reason distribution dan acknowledge alarm.
9. Buka **System Map** untuk melihat batas device, PLC, backend, database, dan browser.

Kontrol line yang tersedia:

| Kontrol | Perilaku |
|---|---|
| Start | Mengubah line ke `RUNNING` bila emergency stop tidak aktif. |
| Stop | Menghentikan pergerakan line secara terkontrol. |
| Emergency stop | Melatch kondisi safety, menghentikan motion, dan membuat alarm kritis. |
| Reset safety | Mengakui alarm E-stop dan mengembalikan line ke `STOPPED`; operator masih harus melakukan Start. |
| Reset simulation | Menghapus produk aktif/alarm simulasi dan mengembalikan scenario ke normal. |
| Acknowledge | Menandai alarm tertentu sebagai sudah diketahui operator. |

## Skenario simulasi

| Scenario | Hasil vision | Hasil barcode | Disposition | Reason code |
|---|---:|---:|---:|---|
| `normal` | PASS | PASS | ACCEPT | — |
| `vision_defect` | FAIL | PASS | REJECT | `VISION_LABEL_SKEW` |
| `barcode_no_read` | PASS | FAIL | REJECT | `BARCODE_NO_READ` |
| `duplicate_serial` | PASS | FAIL | REJECT | `BARCODE_DUPLICATE` |
| `backend_timeout` | PASS | TIMEOUT | REJECT | `BACKEND_TIMEOUT` |

Detail deterministik yang digunakan demo:

- Produk normal memiliki label offset `+0.4 mm`, cap confidence `99.2%`, dan barcode grade `A`.
- Vision defect memiliki label offset `+4.8 mm`, melebihi batas contoh `±2.0 mm`.
- Barcode no-read mensimulasikan kegagalan decode setelah `450 ms`.
- Duplicate serial memakai serial historis agar collision mudah ditunjukkan.
- Backend timeout menggunakan fail-safe window `500 ms` dan membuat alarm `COM-BE-500`.
- Produk reject bergerak lebih lambat saat stroke pusher agar aktuasi dan konfirmasi dapat diamati.

## OPC UA

### Endpoint lokal

```text
opc.tcp://127.0.0.1:4840/FactoryTrace
```

Namespace demo berada di `ns=1;s=FactoryTrace/PKG02/*`.

### Read-only process nodes

| Browse name | Data type | Isi |
|---|---|---|
| `Line.State` | String | `RUNNING`, `STOPPED`, atau `EMERGENCY_STOP`. |
| `Line.SpeedActual` | Double | Kecepatan aktual simulasi; `30.2` ketika running. |
| `Line.ActiveProductCount` | UInt16 | Jumlah unit aktif di conveyor. |
| `Order.Number` | String | Nomor work order aktif. |
| `Product.Sequence` | UInt32 | Sequence produk terdepan. |
| `Product.Serial` | String | Serial produk terdepan. |
| `Product.Position` | Double | Posisi unit pada line virtual. |
| `Product.VisionResult` | String | `PENDING`, `PASS`, atau `FAIL`. |
| `Product.BarcodeResult` | String | `PENDING`, `PASS`, `FAIL`, atau `TIMEOUT`. |
| `Product.Disposition` | String | `PENDING`, `ACCEPT`, atau `REJECT`. |
| `Safety.EStopLatched` | Boolean | Status latch emergency stop. |
| `SnapshotJson` | String | Snapshot lengkap yang dimonitor bridge setiap 100 ms. |

### Writable command nodes

| Browse name | Data type | Fungsi |
|---|---|---|
| `Command.StartRequest` | Boolean | Start ketika ditulis `true`. |
| `Command.StopRequest` | Boolean | Stop ketika ditulis `true`. |
| `Command.EmergencyStopRequest` | Boolean | Melatch E-stop simulasi. |
| `Command.ResetSafetyRequest` | Boolean | Reset safety latch. |
| `Command.ResetSimulationRequest` | Boolean | Reset state demo. |
| `Command.InjectScenario` | String | Inject satu produk dengan nama scenario. |
| `Command.AcknowledgeAlarm` | String | Acknowledge alarm berdasarkan ID. |

## API HTTP dan SSE

### Bridge lokal — port 4001

| Method | Endpoint | Kegunaan |
|---|---|---|
| `GET` | `/health` | Status koneksi bridge dan metadata OPC UA Subscription. |
| `GET` | `/api/snapshot` | Snapshot state PLC terbaru. |
| `GET` | `/api/events` | Stream SSE untuk perubahan snapshot. |
| `POST` | `/api/command` | Menulis command ke OPC UA Server. |

Contoh command:

```bash
curl -X POST http://127.0.0.1:4001/api/command \
  -H 'content-type: application/json' \
  -d '{"command":"inject","value":"vision_defect"}'
```

Nilai `command` yang didukung: `start`, `stop`, `emergency`, `resetSafety`, `reset`, `inject`, dan `acknowledge`.

### Web API — `/api/products`

| Method | Perilaku |
|---|---|
| `GET` | Mengambil maksimal 24 produk selesai terbaru dari D1. |
| `POST` | Memvalidasi dan menyimpan satu produk selesai beserta seluruh event-nya. |

Request POST harus memiliki minimal `id`, `serial`, dan `completedAt`. API membuat schema yang diperlukan secara idempotent sebelum query.

## Database dan persistensi

Database menggunakan dua tabel:

### `product_units`

Menyimpan identitas produk, sequence, work order, batch, scenario, hasil vision/barcode, disposition, reason code, measurement, timestamp, dan JSON payload lengkap.

### `product_events`

Menyimpan event per produk: event ID, product ID, event type, station, waktu kejadian, dan detail.

Index penting:

- `idx_product_units_serial` adalah index non-unique agar kejadian duplicate serial tetap tersimpan sebagai bukti traceability.
- `idx_product_units_sequence` bersifat unique untuk menjaga identitas urutan unit.
- `idx_product_events_product_id` mempercepat pengambilan perjalanan sebuah produk.

Migration SQL berada di folder `drizzle/`. Konfigurasi binding lokal/hosting berada di `.openai/hosting.json` dengan binding D1 bernama `DB`.

## Struktur direktori

```text
factorytrace/
├── app/
│   ├── api/products/route.ts   # persistence API untuk completed products
│   ├── globals.css             # design system dan responsive styles
│   ├── layout.tsx              # metadata dan root layout
│   └── page.tsx                # application entry page
├── components/
│   ├── DashboardViews.tsx      # Trace, Quality, Alarm, System Map views
│   └── FactoryScene.tsx        # Three.js digital twin
├── db/
│   ├── index.ts                # D1/Drizzle client
│   └── schema.ts               # relational schema
├── docs/
│   ├── PRD-FactoryTrace.md     # product requirements lengkap
│   └── research-opc-ua.md      # riset dan batas implementasi OPC UA
├── drizzle/                    # SQL migrations dan metadata
├── hooks/
│   └── useLineSimulator.ts     # browser fallback + OPC UA bridge integration
├── lib/
│   ├── domain.ts               # domain types dan work-order fixture
│   └── seed-data.ts            # historical demo products
├── public/                     # favicon, OG image, dan static assets
├── simulator/
│   ├── opcua-bridge.mjs        # OPC UA Client + HTTP/SSE server
│   ├── opcua-server.mjs        # OPC UA Server dan tag namespace
│   ├── plc-engine.mjs          # deterministic PLC behavior model
│   └── start-local.mjs         # multi-process local launcher
├── tests/                      # behavior, regression, dan render tests
├── worker/index.ts             # Cloudflare Worker entry
├── vite.config.ts              # vinext, Sites, Cloudflare, dan local bindings
└── package.json                # scripts dan dependencies
```

## Perintah npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan web app development dengan browser simulator fallback. |
| `npm run dev:opcua` | Menjalankan PLC Server, bridge, dan web app sekaligus. |
| `npm run plc:server` | Menjalankan OPC UA PLC simulator saja. |
| `npm run opcua:bridge` | Menjalankan OPC UA Client HTTP/SSE bridge saja. |
| `npm run build` | Membuat production build ke folder `dist/`. |
| `npm run start` | Menjalankan production build vinext. |
| `npm run lint` | Menjalankan ESLint, mengabaikan output build. |
| `npm test` | Build production lalu menjalankan seluruh Node.js tests. |
| `npm run db:generate` | Membuat migration Drizzle dari perubahan schema. |

## Pengujian

Jalankan pemeriksaan lengkap:

```bash
npx tsc --noEmit
npm run lint
npm test
```

Test suite mencakup:

- Rendered HTML dan metadata portfolio.
- Semua skenario PLC: accept, vision defect, no-read, duplicate, dan timeout.
- Emergency-stop latch dan reset safety.
- Scenario one-shot agar fault hanya diterapkan pada unit yang dipilih.
- Timing reject pusher agar animasi reject dapat diamati.

`npm test` sengaja menjalankan build lebih dahulu karena rendered HTML test mengimpor worker dari hasil production build.

## Deployment

Web application dirancang untuk runtime Cloudflare Workers melalui vinext dan Cloudflare Vite plugin. D1 binding yang diharapkan bernama `DB`.

Sebelum deployment:

1. Pastikan D1 database tersedia dan binding `DB` mengarah ke database yang benar.
2. Terapkan migration di folder `drizzle/` sesuai pipeline environment.
3. Jalankan `npm run build`, `npm run lint`, dan `npm test`.
4. Pastikan secret atau credential tidak dimasukkan ke repository; file `.env*` sudah diabaikan Git.

Raw OPC UA TCP tidak dijalankan di browser/edge deployment. Untuk integrasi PLC nyata, jalankan bridge pada host yang memiliki akses ke jaringan OT, lalu gunakan transport backend yang diautentikasi dan dibatasi origin untuk menghubungkan UI.

## Batasan dan keamanan

- Endpoint lokal memakai anonymous access, `MessageSecurityMode.None`, dan `SecurityPolicy.None` hanya untuk demo loopback.
- Konfigurasi production wajib menggunakan certificate, trust list, authenticated identity, role-based write access, audit logging, serta `SignAndEncrypt` sesuai security design pabrik.
- CORS bridge saat ini `*` untuk kemudahan demo lokal. Batasi allowed origin sebelum dipakai di jaringan lain.
- Emergency stop di proyek ini hanya simulasi software. Safety function nyata harus menggunakan safety-rated hardware dan desain tervalidasi.
- Simulator menggunakan angka measurement deterministik; hasil tersebut bukan output kamera atau barcode reader fisik.
- Mapping device seperti vision sensor dan reader bersifat konseptual, bukan klaim kompatibilitas penuh terhadap protokol proprietary vendor.
- Belum ada authentication/authorization operator pada UI demo.
- Data D1 adalah histori demo dan bukan electronic batch record tervalidasi atau sistem GxP siap produksi.

## Troubleshooting

### UI menunjukkan `BROWSER SIM`, bukan `OPC UA`

- Pastikan `npm run dev:opcua` digunakan.
- Periksa `http://127.0.0.1:4001/health`.
- Pastikan port `4001` dan `4840` tidak digunakan proses lain.
- Lihat log berlabel `[PLC]`, `[BRIDGE]`, dan `[WEB]` di terminal.

### Bridge gagal tersambung

Jalankan OPC UA Server lebih dahulu dan tunggu endpoint muncul, baru jalankan bridge. Endpoint yang diharapkan adalah `opc.tcp://127.0.0.1:4840/FactoryTrace`.

### Produk tidak bergerak

- Pastikan line berstatus `RUNNING`.
- Jika E-stop aktif, lakukan **Reset safety**, lalu **Start**.
- Pastikan tab browser tidak membatasi timer karena berjalan lama di background.

### Histori tidak tersimpan

- Pastikan binding D1 `DB` aktif.
- Periksa response `/api/products` dan log development server.
- Produk baru disimpan setelah mencapai status selesai dan mempunyai `completedAt`.

### WebGL tidak tampil

Aktifkan hardware acceleration pada browser, gunakan browser modern, lalu periksa dukungan WebGL perangkat. Reduced-motion mengurangi motion tetapi tidak menonaktifkan scene 3D.

### Build gagal setelah install

Pastikan Node.js memenuhi `>=22.13.0`, hapus asumsi penggunaan runtime lama dari shell, lalu jalankan kembali `npm install` dan `npm run build`.

## Dokumentasi lanjutan

- [Product Requirements Document](docs/PRD-FactoryTrace.md) — latar belakang, persona, tujuan, UX, acceptance criteria, risiko, dan roadmap.
- [Riset OPC UA](docs/research-opc-ua.md) — referensi primer, prinsip komunikasi, security boundary, dan keputusan implementasi simulator.

## Lisensi

Repository ini belum menyertakan file lisensi. Secara default, hak cipta tetap pada pemilik repository dan penggunaan ulang tidak otomatis diizinkan sampai sebuah lisensi ditambahkan.
