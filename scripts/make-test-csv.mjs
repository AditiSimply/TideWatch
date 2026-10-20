#!/usr/bin/env node
/**
 * Tidewatch — CICIDS2017 test CSV generator
 * ==========================================
 * Produces 5 ready-to-upload CSV files for the Analyze page / POST /predict/batch.
 * Each file matches the exact 30-feature schema + metadata columns the model expects:
 *
 *   30 features + Label + Source IP + Destination IP + Protocol
 *
 * Files written to ./test-data/:
 *   1_ddos_loic_flood.csv      — DDoS-LOIC volumetric flood
 *   2_portscan_sweep.csv       — SYN port-scan sweep
 *   3_dos_goldeneye.csv        — GoldenEye HTTP hold
 *   4_benign_https.csv         — normal HTTPS/HTTP traffic
 *   5_mixed_incident.csv       — blended benign + multi-vector attacks
 *
 * Usage:
 *   npm run make-test-csv              # default 200 rows/file
 *   node scripts/make-test-csv.mjs --rows 500
 *   node scripts/make-test-csv.mjs --seed 7
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'test-data')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  return fallback
}
const ROWS = parseInt(arg('rows', '200'), 10)
const SEED = parseInt(arg('seed', '42'), 10)

// ── Deterministic RNG ────────────────────────────────────────────────────────
let _a = SEED >>> 0
function rng() {
  _a |= 0
  _a = (_a + 0x6d2b79f5) | 0
  let t = Math.imul(_a ^ (_a >>> 15), 1 | _a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min
const randFloat = (min, max) => rng() * (max - min) + min
const choice = (arr) => arr[Math.floor(rng() * arr.length)]
function gauss(mean, std) {
  let u = 0, v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.max(0, mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std)
}
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d

// ── Feature schema (exact model order) ───────────────────────────────────────
let FEATURES = [
  'Destination Port', 'Flow Duration', 'Total Fwd Packets', 'Total Backward Packets',
  'Total Length of Fwd Packets', 'Total Length of Bwd Packets', 'Fwd Packet Length Mean',
  'Bwd Packet Length Mean', 'Bwd Packet Length Std', 'Flow Bytes/s', 'Flow Packets/s',
  'Flow IAT Mean', 'Flow IAT Std', 'Flow IAT Max', 'Fwd IAT Mean', 'Bwd IAT Mean',
  'Fwd Header Length', 'Bwd Header Length', 'Fwd Packets/s', 'Bwd Packets/s',
  'Packet Length Mean', 'Packet Length Std', 'SYN Flag Count', 'RST Flag Count',
  'PSH Flag Count', 'ACK Flag Count', 'URG Flag Count', 'Init_Win_bytes_forward',
  'Init_Win_bytes_backward', 'min_seg_size_forward',
]
try {
  const parsed = JSON.parse(readFileSync(path.join(ROOT, 'artifacts', 'features.json'), 'utf8'))
  if (Array.isArray(parsed) && parsed.length) FEATURES = parsed
} catch { /* default */ }

const HEADER = [...FEATURES, 'Label', 'Source IP', 'Destination IP', 'Protocol']

// ── Flow builders ────────────────────────────────────────────────────────────
function buildFlow(o) {
  const totalPkts = o.fwdPkts + o.bwdPkts
  const feats = {
    'Destination Port': o.dstPort,
    'Flow Duration': round(o.duration, 2),
    'Total Fwd Packets': o.fwdPkts,
    'Total Backward Packets': o.bwdPkts,
    'Total Length of Fwd Packets': round(o.fwdLen, 2),
    'Total Length of Bwd Packets': round(o.bwdLen, 2),
    'Fwd Packet Length Mean': round(o.fwdLen / Math.max(1, o.fwdPkts), 2),
    'Bwd Packet Length Mean': round(o.bwdLen / Math.max(1, o.bwdPkts), 2),
    'Bwd Packet Length Std': round(randFloat(10, 200), 2),
    'Flow Bytes/s': round((o.fwdLen + o.bwdLen) / Math.max(1e-6, o.duration / 1e6), 2),
    'Flow Packets/s': round(totalPkts / Math.max(1e-6, o.duration / 1e6), 2),
    'Flow IAT Mean': round(o.iatMean, 2),
    'Flow IAT Std': round(o.iatMean * randFloat(0.2, 0.8), 2),
    'Flow IAT Max': round(o.iatMean * randFloat(1.5, 3.0), 2),
    'Fwd IAT Mean': round(o.iatMean * randFloat(0.9, 1.3), 2),
    'Bwd IAT Mean': round(o.iatMean * randFloat(0.7, 1.1), 2),
    'Fwd Header Length': o.fwdPkts * 32,
    'Bwd Header Length': o.bwdPkts * 32,
    'Fwd Packets/s': round(o.fwdPkts / Math.max(1e-6, o.duration / 1e6), 2),
    'Bwd Packets/s': round(o.bwdPkts / Math.max(1e-6, o.duration / 1e6), 2),
    'Packet Length Mean': round((o.fwdLen + o.bwdLen) / Math.max(1, totalPkts), 2),
    'Packet Length Std': round(randFloat(50, 450), 2),
    'SYN Flag Count': o.syn,
    'RST Flag Count': o.rst,
    'PSH Flag Count': o.psh ?? 0,
    'ACK Flag Count': o.ack ?? 0,
    'URG Flag Count': o.urg ?? 0,
    'Init_Win_bytes_forward': o.initWinFwd,
    'Init_Win_bytes_backward': o.initWinBwd ?? 0,
    'min_seg_size_forward': 32,
  }
  const row = {}
  for (const f of FEATURES) row[f] = feats[f] !== undefined ? feats[f] : 0
  return row
}

const SCENARIOS = {
  benign: () => {
    const dstPort = choice([80, 443, 443, 443, 53, 8080])
    const fwdPkts = Math.max(2, Math.round(gauss(12, 8)))
    const bwdPkts = Math.max(1, Math.round(gauss(10, 7)))
    return buildFlow({
      dstPort, duration: gauss(1_200_000, 800_000) + 1000,
      fwdPkts, bwdPkts, fwdLen: fwdPkts * gauss(350, 160), bwdLen: bwdPkts * gauss(350, 155),
      iatMean: gauss(8500, 4000) + 100, syn: 1, rst: 0, psh: randInt(2, 6), ack: randInt(10, 28),
      initWinFwd: choice([65535, 64240, 29200]), initWinBwd: 65535,
    })
  },
  ddos: () => buildFlow({
    dstPort: 80, duration: randFloat(15_000, 45_000),
    fwdPkts: randInt(600, 1500), bwdPkts: randInt(1, 6),
    fwdLen: randInt(600, 1500) * randFloat(250, 450), bwdLen: 60, iatMean: randFloat(15, 45),
    syn: 1, ack: 1, initWinFwd: 29200, initWinBwd: 0,
  }),
  portscan: () => {
    const fwdPkts = randInt(1, 2)
    const bwdPkts = randInt(0, 1)
    return buildFlow({
      dstPort: randInt(1, 1024), duration: randFloat(80, 400),
      fwdPkts, bwdPkts, fwdLen: fwdPkts * 40, bwdLen: bwdPkts * 40, iatMean: randFloat(80, 400),
      syn: 1, rst: bwdPkts > 0 ? 1 : 0, initWinFwd: 1024, initWinBwd: 0,
    })
  },
  goldeneye: () => buildFlow({
    dstPort: choice([8080, 80]), duration: randFloat(200_000, 1_000_000),
    fwdPkts: randInt(80, 250), bwdPkts: randInt(20, 80),
    fwdLen: randInt(80, 250) * 120, bwdLen: randInt(20, 80) * 40, iatMean: randFloat(800, 3500),
    syn: 1, ack: 1, initWinFwd: 8192, initWinBwd: 0,
  }),
  brute: () => buildFlow({
    dstPort: choice([22, 3389, 21]), duration: randFloat(400_000, 800_000),
    fwdPkts: randInt(200, 500), bwdPkts: randInt(150, 400),
    fwdLen: randInt(200, 500) * 180, bwdLen: randInt(150, 400) * 140, iatMean: randFloat(600, 1200),
    syn: 1, ack: 1, initWinFwd: 65535, initWinBwd: 65535,
  }),
}

// ── CSV serialization ────────────────────────────────────────────────────────
function csvEscape(v) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function toCsv(rows) {
  const lines = [HEADER.join(',')]
  for (const { features, label, srcIp, protocol, dstPort } of rows) {
    const vals = FEATURES.map((f) => csvEscape(features[f]))
    vals.push(csvEscape(label), csvEscape(srcIp), csvEscape('192.168.10.1'), csvEscape(protocol ?? 'TCP'))
    lines.push(vals.join(','))
  }
  return lines.join('\n') + '\n'
}

function makeRows(n, mixFn) {
  const out = []
  for (let i = 0; i < n; i++) {
    const spec = mixFn(i)
    const features = SCENARIOS[spec.kind]()
    out.push({
      features,
      label: spec.label,
      srcIp: spec.srcIp,
      protocol: spec.kind === 'benign' && features['Destination Port'] === 53 ? 'UDP' : 'TCP',
    })
  }
  return out
}

// ── File definitions ─────────────────────────────────────────────────────────
const FILES = [
  {
    name: '1_ddos_loic_flood.csv',
    make: () => makeRows(ROWS, () => ({ kind: 'ddos', label: 'DDoS', srcIp: '205.174.165.73' })),
  },
  {
    name: '2_portscan_sweep.csv',
    make: () => makeRows(ROWS, () => ({ kind: 'portscan', label: 'PortScan', srcIp: '192.168.10.51' })),
  },
  {
    name: '3_dos_goldeneye.csv',
    make: () => makeRows(ROWS, () => ({ kind: 'goldeneye', label: 'DoS', srcIp: '172.16.0.1' })),
  },
  {
    name: '4_benign_https.csv',
    make: () => makeRows(ROWS, () => ({
      kind: 'benign', label: 'BENIGN',
      srcIp: `192.168.${randInt(1, 20)}.${randInt(1, 254)}`,
    })),
  },
  {
    name: '5_mixed_incident.csv',
    make: () => {
      // Deterministic blend: 55% benign, rest split across attack vectors.
      const plan = [
        { kind: 'benign', label: 'BENIGN', srcIp: null, w: 0.55 },
        { kind: 'ddos', label: 'DDoS', srcIp: '205.174.165.73', w: 0.15 },
        { kind: 'portscan', label: 'PortScan', srcIp: '192.168.10.51', w: 0.12 },
        { kind: 'goldeneye', label: 'DoS', srcIp: '172.16.0.1', w: 0.10 },
        { kind: 'brute', label: 'BruteForce', srcIp: '45.33.32.156', w: 0.08 },
      ]
      return makeRows(ROWS, () => {
        let r = rng()
        for (const p of plan) {
          if (r < p.w) {
            return {
              kind: p.kind,
              label: p.label,
              srcIp: p.srcIp ?? `192.168.${randInt(1, 20)}.${randInt(1, 254)}`,
            }
          }
          r -= p.w
        }
        return { kind: 'benign', label: 'BENIGN', srcIp: `192.168.${randInt(1, 20)}.${randInt(1, 254)}` }
      })
    },
  },
]

// ── Run ──────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
console.log(`[csv] Writing ${FILES.length} test files (${ROWS} rows each) → test-data/\n`)
for (const f of FILES) {
  const rows = f.make()
  const csv = toCsv(rows)
  writeFileSync(path.join(OUT_DIR, f.name), csv, 'utf8')
  const attacks = rows.filter((r) => r.label !== 'BENIGN').length
  console.log(
    `  ✓ ${f.name.padEnd(26)} ${rows.length} rows  (${rows.length - attacks} benign, ${attacks} attack)`
  )
}
console.log(`\n[csv] Done. Upload any file via the Analyze page or POST /api/v1/predict/batch.`)
console.log(`[csv] Column count: ${HEADER.length} (${FEATURES.length} features + Label + Source IP + Destination IP + Protocol)`)
