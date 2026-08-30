# Riset OPC UA untuk FactoryTrace

Tanggal riset: 25 Agustus 2026  
Ruang lingkup: arsitektur OPC UA dan syarat simulator PLC/line lokal yang kredibel untuk portofolio.

## Kesimpulan

Audit awal menemukan FactoryTrace **belum memakai OPC UA sungguhan dan belum menjalankan PLC simulator sebagai proses terpisah**. Setelah audit tersebut, implementasi lokal ditambahkan di `simulator/`: proses PLC/line simulator membuka OPC UA Server, backend bridge membuat OPC UA Client Session + Subscription, dan browser mengonsumsi bridge melalui HTTP/SSE. Simulasi React lama dipertahankan sebagai fallback untuk deployment hosted yang tidak dapat membuka raw TCP.

Implementasi yang kredibel untuk portofolio adalah:

```text
Browser (Three.js/HMI)
        │ HTTP + WebSocket
        ▼
Backend / Traceability Orchestrator  = OPC UA Client
        │ opc.tcp, subscribe + read/write
        ▼
OPC UA PLC/Line Simulator            = OPC UA Server
        │
        └── AddressSpace: PLC tags, sensors, conveyor, reject station
```

Gunakan nama **“OPC UA PLC/line simulator”** atau **“digital twin”**, bukan “Keyence KV-8000 emulator”. `node-opcua` dapat mensimulasikan endpoint, namespace, data tags, subscriptions, writes, faults, dan reconnect. Ia tidak mengemulasikan CPU/firmware KV-8000, ladder execution Keyence, I/O elektrikal, safety relay, atau timing pneumatik fisik. Pernyataan terakhir adalah batasan engineering yang disimpulkan dari apa yang diemulasikan software, bukan klaim OPC Foundation.

## Dasar standar

OPC UA adalah arsitektur service-oriented yang platform-independent. Server menyajikan data sebagai **AddressSpace hierarkis**; Client dapat melakukan discovery/browse, membaca dan menulis data, menjalankan Method, serta menerima perubahan melalui Subscriptions dan Events. Standar juga mendukung information modeling, sehingga tag tidak hanya berupa angka tanpa konteks. ([OPC Foundation — Unified Architecture](https://opcfoundation.org/about/opc-technologies/opc-ua/))

Dalam pola Client–Server:

- **OPC UA Server** memiliki AddressSpace dan menyediakan services atas Nodes. Untuk proyek ini, simulator line/PLC adalah Server.
- **OPC UA Client** membuat koneksi dan Session, browse/read/write Nodes, serta membuat Subscription. Untuk proyek ini, adapter backend adalah Client.
- Browser sebaiknya tidak menjadi OPC UA Client langsung. Browser berkomunikasi dengan backend melalui HTTP/WebSocket; backend menjaga session, certificates, reconnect, access control, dan menerjemahkan data untuk UI. Ini adalah rekomendasi arsitektur proyek, bukan kewajiban normatif OPC UA.

OPC Foundation menjelaskan bahwa MonitoredItems mengawasi attribute atau event, lalu Subscription mengirim Notifications pada publishing interval. Karena itu backend sebaiknya **subscribe**, bukan melakukan polling HTTP terus-menerus. Sampling interval, filter/deadband, queue size, publishing interval, keep-alive, dan lifetime perlu dikonfigurasi dengan sadar. ([OPC UA Part 4 §5.13 — MonitoredItems](https://reference.opcfoundation.org/specs/OPC-10000-4/5.13), [OPC UA Part 4 §5.14 — Subscriptions](https://reference.opcfoundation.org/specs/OPC-10000-4/5.14))

## Kontrak minimum AddressSpace

NodeIds harus stabil agar client tidak bergantung pada browse name yang kebetulan. Contoh namespace proyek:

| NodeId | Type | Access | Fungsi |
|---|---|---|---|
| `ns=2;s=FactoryTrace.Line.Mode` | String/Enum | Read | AUTO, MANUAL, STOPPED, FAULTED |
| `ns=2;s=FactoryTrace.Line.Running` | Boolean | Read | Status aktual line |
| `ns=2;s=FactoryTrace.Line.EStopHealthy` | Boolean | Read | Status safety input simulasi |
| `ns=2;s=FactoryTrace.Conveyor.Speed` | Double | Read/Write terbatas | Setpoint/actual speed simulasi |
| `ns=2;s=FactoryTrace.Sensor.S01.Present` | Boolean | Read | Product presence |
| `ns=2;s=FactoryTrace.Vision.Result` | Enum | Read | PASS/FAIL/NO_READ |
| `ns=2;s=FactoryTrace.Barcode.Value` | String | Read | Serial hasil scan |
| `ns=2;s=FactoryTrace.Reject.CommandId` | UInt32 | Write | Nomor command baru |
| `ns=2;s=FactoryTrace.Reject.Command` | Boolean/Enum | Write | Request reject simulasi |
| `ns=2;s=FactoryTrace.Reject.AckId` | UInt32 | Read | Command yang sudah diterima PLC |
| `ns=2;s=FactoryTrace.Reject.State` | Enum | Read | IDLE, EXTENDING, CONFIRMED, RETRACTING |
| `ns=2;s=FactoryTrace.Diagnostics.Heartbeat` | UInt32 | Read | Health/reconnect test |

Setiap perubahan telemetry perlu membawa nilai, OPC UA `StatusCode`/quality, dan source/server timestamps. Jangan menampilkan data lama sebagai kondisi mesin terkini setelah koneksi putus.

### Read, Write, dan command handshake

OPC UA memang menyediakan on-demand Read/Write sesuai access permissions dan Method execution. ([OPC Foundation — Functional Equivalence](https://opcfoundation.org/about/opc-technologies/opc-ua/), [OPC UA Part 4 — Services](https://reference.opcfoundation.org/specs/OPC-10000-4/4))

Untuk PLC-style integration, gunakan writable command tags dengan tag acknowledgment/state terpisah. Contoh alur:

```text
Backend write Reject.CommandId=42 + Reject.Command=REQUEST
PLC simulator validate interlock dan antrean produk
PLC simulator publish Reject.AckId=42
PLC simulator publish State=EXTENDING → CONFIRMED → RETRACTING → IDLE
```

`CommandId/AckId` adalah rekomendasi desain proyek agar retry/reconnect tidak menyebabkan command hilang atau dieksekusi dua kali. OPC UA juga mendukung Methods, tetapi writable Variables lebih dekat dengan coil/register handshake yang lazim diekspos gateway PLC. Model aktual harus disesuaikan dengan tag contract PLC/gateway di pabrik. ([OPC UA Information Model Best Practices §8.1](https://reference.opcfoundation.org/Model-Best/v103/docs/8.1))

## Perilaku simulator yang harus ada

Minimum agar demo lebih dari sekadar animasi:

1. Proses Node.js terpisah membuka endpoint nyata, misalnya `opc.tcp://127.0.0.1:4840/factorytrace`.
2. State machine PLC deterministik memiliki scan/tick sendiri; animasi Three.js hanya memvisualisasikan state tersebut.
3. Backend client membuat Session dan Subscription untuk status line, sensor, vision, barcode, reject, heartbeat, dan alarms.
4. Command Start/Stop/Reset/Acknowledge/Reject menggunakan Write dengan access control dan acknowledgment.
5. Reject menggunakan product FIFO/shift tracking: defect di S02 ditandai, actuator baru bergerak saat produk yang sama tiba di S04.
6. Simulasi gangguan mencakup vision fail, barcode no-read/duplicate, jam, timeout, OPC UA disconnect, bad quality/stale data, dan reconnect.
7. Event/audit log mencatat request, actor, command id, timestamp, hasil Write, acknowledgment, dan disposition produk.
8. Endpoint dapat diperiksa memakai OPC UA Client terpisah, bukan hanya lewat UI FactoryTrace. Repository resmi `node-opcua` menyediakan sample server/client untuk pengujian ini. ([node-opcua official repository](https://github.com/node-opcua/node-opcua))

## Implementasi dengan node-opcua

`node-opcua` adalah TypeScript/Node.js OPC UA stack yang menyediakan Client, Server, Discovery, security policies, dan certificate management. Dokumentasi resminya juga menyediakan sample server dan client. ([node-opcua official repository](https://github.com/node-opcua/node-opcua), [official creating-a-server tutorial](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_server.md))

Komponen yang direkomendasikan:

- `services/opcua-plc-simulator`: `OPCUAServer`, AddressSpace, deterministic line state machine, writable command variables.
- `services/opcua-adapter`: `OPCUAClient`, Session, Subscription/MonitoredItems, reconnect, write API, command correlation.
- Web app: HTTP/WebSocket consumer; tidak mengetahui detail raw NodeId atau certificates.
- Shared tag contract: NodeId, data type, engineering unit, access, initial value, update behavior, timeout, dan command acknowledgment.

Jalankan server dan web app sebagai dua proses lokal. Hal ini juga membuat bukti integrasi terlihat: mematikan simulator harus mengubah UI menjadi disconnected/stale, bukan membuat animasi tetap berjalan seolah PLC sehat.

## Security dan safety

OPC UA mendukung security modes `None`, `Sign`, dan `SignAndEncrypt`. Spesifikasi menyatakan Profile None harus disabled secara default; pemilihan Sign atau SignAndEncrypt mengikuti kebutuhan sistem keamanan. Client dan Server dapat saling mengautentikasi dengan X.509 certificates dan trust lists, sedangkan user authorization dapat dibatasi berdasarkan identity/roles. ([OPC UA Part 2 §4.8](https://reference.opcfoundation.org/specs/OPC-10000-2/4.8), [§4.10 application authentication](https://reference.opcfoundation.org/specs/OPC-10000-2/4), [§4.11 user authorization](https://reference.opcfoundation.org/specs/OPC-10000-2/4.11))

Untuk portofolio:

- Local demo boleh menyediakan endpoint `None` hanya jika jelas berlabel **DEV/INSECURE**, bind ke loopback, dan tidak diekspos ke jaringan.
- Tampilkan production profile: `SignAndEncrypt`, certificate trust, authenticated identity, role-based write permissions, dan audit log.
- Pisahkan read-only telemetry dari command nodes. Anonymous sebaiknya tidak punya akses Write.
- E-STOP pada web hanya **simulasi HMI**. Emergency stop mesin nyata harus melalui safety circuit/relay/PLC yang sesuai; browser, backend, jaringan Ethernet, dan OPC UA bukan satu-satunya safety function.

## Acceptance checklist

- [x] `opc.tcp://127.0.0.1:4840/FactoryTrace` berjalan dan dapat dihubungi OPC UA Client.
- [x] Stable namespace dan NodeIds terdokumentasi.
- [x] Client menerima perubahan lewat Subscription/MonitoredItems.
- [ ] Write command menghasilkan ack dan state transition yang cocok.
- [ ] Write tanpa hak akses ditolak dengan status yang benar.
- [ ] Putus koneksi mengubah UI menjadi disconnected/stale; reconnect memulihkan subscription.
- [x] Reject defect product menggerakkan actuator hanya ketika produk terkait mencapai station reject.
- [ ] StatusCode/quality dan timestamps diteruskan ke backend/UI.
- [x] Mode insecure hanya untuk loopback dev; production profile terdokumentasi.
- [x] Dokumentasi tidak mengklaim emulasi hardware Keyence.

## Sumber primer

- [OPC Foundation — Unified Architecture](https://opcfoundation.org/about/opc-technologies/opc-ua/)
- [OPC UA Part 4 — Services](https://reference.opcfoundation.org/specs/OPC-10000-4/full)
- [OPC UA Part 2 — Security Model](https://reference.opcfoundation.org/specs/OPC-10000-2/full)
- [node-opcua official repository](https://github.com/node-opcua/node-opcua)
- [node-opcua creating-a-server tutorial](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_server.md)
