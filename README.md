# FactoryTrace

FactoryTrace is an interactive PLC traceability digital twin for a simulated pharmaceutical packaging line. It demonstrates how field devices, PLC sequencing, OPC UA, business validation, and unit-level genealogy work together.

## Demo scope

- Three.js packaging line with orbitable overview, inspection, and reject cameras
- Deterministic PLC-style state machine and product-position FIFO
- Vision defect, barcode no-read, duplicate serial, and backend timeout scenarios
- Correct-product reject sequencing and confirmation
- Product trace search, append-only event timeline, and historical journey replay
- Quality distribution, alarm acknowledgement, and OPC UA system map
- D1-backed completed-product history for hosted deployments

All company, product, serial, order, batch, and regulatory-looking data is fictional. The simulator is a portfolio demonstrator, not a safety system or hardware commissioning substitute.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npx tsc --noEmit
npm run lint
npm test
```

The authoritative product specification is in `docs/PRD-FactoryTrace.md`.
