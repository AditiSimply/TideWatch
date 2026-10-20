#!/usr/bin/env node
/**
 * Tidewatch — Database Seeder
 * ===========================
 * Populates a Neon PostgreSQL database with a realistic, correlated
 * CICIDS2017-style NIDS dataset so the dashboard, alerts, and model pages
 * all render with live data (instead of the frontend's hardcoded fallbacks).
 *
 * What it writes:
 *   - flows         : benign + attack network flow records (78-dim feature vectors)
 *   - alerts        : one alert per attack flow, with severity + status lifecycle
 *   - ai_reports    : SecOps triage reports with SHAP-style salient features
 *   - model_runs    : model evaluation snapshot (confusion matrix, F1, importances)
 *
 * Usage:
 *   node scripts/seed.mjs
 *   node scripts/seed.mjs --flows 5000 --days 7
 *   node scripts/seed.mjs --reset            # truncate first
 *
 * Env:
 *   DATABASE_URL (required) — Neon pooled Postgres URL
 *     e.g. postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
 */

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import pg from 'pg'

const { Client } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─── CLI args ────────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1]
  }
  return fallback
}
const FLAG = (name) => process.argv.includes(`--${name}`)

const N_FLOWS = parseInt(arg('flows', '3000'), 10)
const N_DAYS = parseInt(arg('days', '7'), 10)
const RESET = FLAG('reset')
const DRY_RUN = FLAG('dry-run')

// ─── Env loading (.env fallback) ─────────────────────────────────────────────
function loadEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const raw = readFileSync(path.join(ROOT, '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/)
      if (m) return m[1].replace(/^["']|["']$/g, '').trim()
    }
  } catch {
    /* no .env */
  }
  return null
}

let DATABASE_URL = loadEnv()
if (!DATABASE_URL && !DRY_RUN) {
  console.error(
    '\n[seed] ERROR: DATABASE_URL is not set.\n' +
      '       Add your Neon pooled connection string to .env, e.g.:\n' +
      '       DATABASE_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require\n' +
      '       (or run with: DATABASE_URL=... npm run seed)\n'
  )
  process.exit(1)
}

// Normalize any driver prefix to plain postgres:// for the `pg` client.
if (DATABASE_URL) {
  DATABASE_URL = DATABASE_URL
    .replace(/^postgresql\+asyncpg:\/\//, 'postgresql://')
    .replace(/^postgres:\/\//, 'postgresql://')
}

// ─── Deterministic RNG (mulberry32) ──────────────────────────────────────────
function makeRng(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const SEED = parseInt(arg('seed', '42'), 10)
const rng = makeRng(SEED)

const rand = () => rng()
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min
const randFloat = (min, max) => rng() * (max - min) + min
const choice = (arr) => arr[Math.floor(rng() * arr.length)]

// Gaussian via Box–Muller, clamped at 0 for non-negative flow metrics.
function gauss(mean, std) {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.max(0, mean + z * std)
}

// ─── Feature schema (must match artifacts/features.json / train.py) ──────────
const FEATURES = [
  'Destination Port',
  'Flow Duration',
  'Total Fwd Packets',
  'Total Backward Packets',
  'Total Length of Fwd Packets',
  'Total Length of Bwd Packets',
  'Fwd Packet Length Mean',
  'Bwd Packet Length Mean',
  'Bwd Packet Length Std',
  'Flow Bytes/s',
  'Flow Packets/s',
  'Flow IAT Mean',
  'Flow IAT Std',
  'Flow IAT Max',
  'Fwd IAT Mean',
  'Bwd IAT Mean',
  'Fwd Header Length',
  'Bwd Header Length',
  'Fwd Packets/s',
  'Bwd Packets/s',
  'Packet Length Mean',
  'Packet Length Std',
  'SYN Flag Count',
  'RST Flag Count',
  'PSH Flag Count',
  'ACK Flag Count',
  'URG Flag Count',
  'Init_Win_bytes_forward',
  'Init_Win_bytes_backward',
  'min_seg_size_forward',
]

// Try to honor the repo's trained feature list if present.
let featureNames = FEATURES
try {
  const parsed = JSON.parse(readFileSync(path.join(ROOT, 'artifacts', 'features.json'), 'utf8'))
  if (Array.isArray(parsed) && parsed.length) featureNames = parsed
} catch {
  /* use default CICIDS_FEATURES */
}

// ─── Attack taxonomy (matches frontend AttackClass labels) ───────────────────
// weight = relative share of ATTACK traffic; severity feeds the alerts table.
const ATTACKS = [
  { label: 'DDoS-LOIC', weight: 0.34, severity: 'critical', dstPort: [80], proto: 'TCP', ip: '205.174.165.73', score: [9.2, 9.9] },
  { label: 'DoS-GoldenEye', weight: 0.14, severity: 'high', dstPort: [8080, 80], proto: 'TCP', ip: '172.16.0.1', score: [7.5, 8.9] },
  { label: 'DoS-Slowloris', weight: 0.10, severity: 'high', dstPort: [80], proto: 'TCP', ip: '172.16.0.1', score: [6.8, 8.2] },
  { label: 'PortScan', weight: 0.26, severity: 'medium', dstPort: null, proto: 'TCP', ip: '192.168.10.51', score: [5.2, 7.4] },
  { label: 'BruteForce', weight: 0.10, severity: 'medium', dstPort: [22, 3389, 21], proto: 'TCP', ip: '45.33.32.156', score: [5.5, 7.8] },
  { label: 'Botnet', weight: 0.06, severity: 'critical', dstPort: [6667, 8080], proto: 'TCP', ip: '198.51.100.22', score: [8.0, 9.5] },
]

const BENIGN_WEIGHT = 0.62 // 62% benign / 38% attack overall

// ─── Per-class flow generators (statistically grounded, non-negative) ────────
function benignFlow() {
  const dstPort = choice([80, 443, 53, 8080, 22, 443, 443])
  const proto = dstPort === 53 ? 'UDP' : 'TCP'
  const duration = gauss(1_200_000, 800_000) + 1_000
  const fwdPkts = Math.max(2, Math.round(gauss(12, 8)))
  const bwdPkts = Math.max(1, Math.round(gauss(10, 7)))
  const fwdLen = fwdPkts * gauss(350, 160)
  const bwdLen = bwdPkts * gauss(350, 155)
  const iatMean = gauss(8500, 4000) + 100
  return buildFlow({
    dstPort, proto, duration, fwdPkts, bwdPkts, fwdLen, bwdLen, iatMean,
    syn: 1, rst: 0, psh: randInt(2, 6), ack: randInt(10, 28), urg: 0,
    initWinFwd: choice([65535, 64240, 29200]), initWinBwd: 65535,
    conf: randFloat(0.972, 0.999),
  })
}

function attackFlow(atk) {
  const dstPort = atk.dstPort ? choice(atk.dstPort) : randInt(1, 1024)
  let duration, fwdPkts, bwdPkts, fwdLen, bwdLen, iatMean
  let syn = 1, rst = 0, psh = 0, ack = 0, urg = 0
  let initWinFwd = 29200, initWinBwd = 0

  switch (atk.label) {
    case 'DDoS-LOIC':
      duration = randFloat(15_000, 45_000)
      fwdPkts = randInt(600, 1500)
      bwdPkts = randInt(1, 6)
      fwdLen = fwdPkts * randFloat(250, 450)
      bwdLen = bwdPkts * 60
      iatMean = randFloat(15, 45)
      ack = 1
      initWinFwd = 29200
      break
    case 'DoS-GoldenEye':
      duration = randFloat(200_000, 1_000_000)
      fwdPkts = randInt(80, 250)
      bwdPkts = randInt(20, 80)
      fwdLen = fwdPkts * 120
      bwdLen = bwdPkts * 40
      iatMean = randFloat(800, 3500)
      ack = 1
      initWinFwd = 8192
      break
    case 'DoS-Slowloris':
      duration = randFloat(600_000, 2_500_000)
      fwdPkts = randInt(40, 120)
      bwdPkts = randInt(30, 90)
      fwdLen = fwdPkts * 90
      bwdLen = bwdPkts * 70
      iatMean = randFloat(5000, 15000)
      ack = 1
      psh = 1
      initWinFwd = 512
      break
    case 'PortScan':
      duration = randFloat(80, 400)
      fwdPkts = randInt(1, 2)
      bwdPkts = randInt(0, 1)
      fwdLen = fwdPkts * 40
      bwdLen = bwdPkts * 40
      iatMean = duration
      rst = bwdPkts > 0 ? 1 : 0
      initWinFwd = 1024
      break
    case 'BruteForce':
      duration = randFloat(400_000, 800_000)
      fwdPkts = randInt(200, 500)
      bwdPkts = randInt(150, 400)
      fwdLen = fwdPkts * 180
      bwdLen = bwdPkts * 140
      iatMean = randFloat(600, 1200)
      ack = 1
      initWinFwd = 65535
      initWinBwd = 65535
      break
    case 'Botnet':
      duration = randFloat(100_000, 600_000)
      fwdPkts = randInt(30, 120)
      bwdPkts = randInt(25, 110)
      fwdLen = fwdPkts * randFloat(100, 200)
      bwdLen = bwdPkts * randFloat(100, 200)
      iatMean = randFloat(2000, 9000)
      ack = 1
      psh = 1
      initWinFwd = 14600
      initWinBwd = 65535
      break
  }

  return buildFlow({
    dstPort, proto: atk.proto, duration, fwdPkts, bwdPkts, fwdLen, bwdLen, iatMean,
    syn, rst, psh, ack, urg, initWinFwd, initWinBwd,
    conf: randFloat(0.86, 0.998),
  })
}

// Assemble a full 78-dim-compatible feature vector from high-level flow stats.
function buildFlow(o) {
  const totalPkts = o.fwdPkts + o.bwdPkts
  const bytesPerSec = (o.fwdLen + o.bwdLen) / Math.max(1e-6, o.duration / 1e6)
  const pktsPerSec = totalPkts / Math.max(1e-6, o.duration / 1e6)
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
    'Flow Bytes/s': round(bytesPerSec, 2),
    'Flow Packets/s': round(pktsPerSec, 2),
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
    'PSH Flag Count': o.psh,
    'ACK Flag Count': o.ack,
    'URG Flag Count': o.urg,
    Init_Win_bytes_forward: o.initWinFwd,
    Init_Win_bytes_backward: o.initWinBwd,
    min_seg_size_forward: 32,
  }
  // Emit exactly the trained feature set (with 0 defaults for any extras).
  const out = {}
  for (const f of featureNames) out[f] = feats[f] !== undefined ? feats[f] : 0
  return { features: out, confidence: o.conf }
}

function round(n, d = 4) {
  const p = 10 ** d
  return Math.round(n * p) / p
}

// ─── IP / endpoint helpers ───────────────────────────────────────────────────
const SRC_SUBNETS = ['10.0', '172.16', '192.168']
function randomSrcIp() {
  return `${choice(SRC_SUBNETS)}.${randInt(1, 20)}.${randInt(1, 254)}`
}
function randomSrcPort() {
  return randInt(49152, 65535)
}

// ─── AI report (SHAP-style triage) generator ─────────────────────────────────
const TAXONOMY = {
  'DDoS-LOIC': 'MITRE ATT&CK: T1498 — Network Denial of Service (LOIC/HOIC flood)',
  'DoS-GoldenEye': 'MITRE ATT&CK: T1499 — Endpoint Denial of Service (GoldenEye)',
  'DoS-Slowloris': 'MITRE ATT&CK: T1499.004 — Application Exhaustion Flood (Slowloris)',
  PortScan: 'MITRE ATT&CK: T1046 — Network Service Discovery (SYN scan)',
  BruteForce: 'MITRE ATT&CK: T1110 — Brute Force (password spraying)',
  Botnet: 'MITRE ATT&CK: T1071 — Application Layer C2 (IRC botnet beacon)',
}

const ROOT_CAUSE = {
  'DDoS-LOIC': 'Volumetric packet-flood signature: constant inter-arrival intervals (~28µs) with line-rate forwarding to port 80 and no payload acknowledgement — consistent with an automated LOIC/HOIC stress tool.',
  'DoS-GoldenEye': 'Sustained low-and-slow connection hold pattern exhausting the HTTP worker pool; repeated keep-alive requests with static initial TCP window (8192) match the GoldenEye toolkit.',
  'DoS-Slowloris': 'Partial-header HTTP requests held open indefinitely, starving the server of concurrent connection slots. Elevated flow duration with minimal per-packet payload.',
  PortScan: 'High-velocity sequential SYN probes across a wide destination-port range with immediate RST teardown — characteristic of an automated network reconnaissance sweep.',
  BruteForce: 'Repeated authentication attempts with rapid retry cadence against a management service; high forward-packet count with uniform segment sizes indicates credential-guessing automation.',
  Botnet: 'Periodic beaconing to an IRC rendezvous port with regular jittered intervals and symmetric small-payload exchanges — indicative of command-and-control check-in traffic.',
}

function makeAiReport(alertId, atk, flow) {
  const f = flow.features
  return {
    alertId,
    explanation: ROOT_CAUSE[atk.label],
    mitigation: {
      attack_taxonomy: TAXONOMY[atk.label],
      salient_features: [
        {
          feature: 'Flow Packets/s',
          observedValue: Math.round(f['Flow Packets/s']),
          benchmark: '120–400 pkts/s',
          contribution: 'high',
        },
        {
          feature: 'Flow IAT Mean',
          observedValue: round(f['Flow IAT Mean'], 2),
          benchmark: '8,400 µs',
          contribution: 'high',
        },
        {
          feature: 'Init_Win_bytes_forward',
          observedValue: f['Init_Win_bytes_forward'],
          benchmark: '65,535',
          contribution: 'medium',
        },
      ],
      impact_assessment:
        atk.severity === 'critical'
          ? 'High probability of egress bottleneck and connection-table exhaustion; immediate containment required.'
          : 'Degraded service responsiveness and elevated resource utilization on the targeted endpoint.',
      mitigations: [
        {
          step: `Drop source ${atk.ip} at the ingress edge firewall`,
          iptablesRule: `iptables -I INPUT -s ${atk.ip} -j DROP`,
          snortRule: `drop tcp ${atk.ip} any -> $HOME_NET any (msg:"TideWatch ${atk.label} block"; sid:10000${randInt(10, 99)}; rev:1;)`,
          priority: 'immediate',
        },
        {
          step: 'Rate-limit matching flows at the load balancer',
          iptablesRule: `iptables -A INPUT -p tcp --dport ${f['Destination Port']} -m limit --limit 50/s -j ACCEPT`,
          priority: atk.severity === 'critical' ? 'immediate' : 'high',
        },
      ],
    },
    severityScore: round(randFloat(atk.score[0], atk.score[1]), 1),
    provider: choice(['groq', 'fallback']),
    model: choice(['llama-3.3-70b-versatile', 'rule-based-heuristics']),
    createdAt: flow.ts,
  }
}

// ─── Model-run metrics snapshot ──────────────────────────────────────────────
function makeModelMetrics() {
  const classes = ['BENIGN', 'DoS', 'DDoS', 'PortScan', 'BruteForce']
  const perClass = classes.map((c) => {
    const p = round(randFloat(0.965, 0.999), 4)
    const r = round(randFloat(0.955, 0.998), 4)
    return {
      className: c,
      precision: p,
      recall: r,
      f1Score: round((2 * p * r) / (p + r), 4),
      support: randInt(250, 4200),
    }
  })
  // Confusion matrix (5x5) with dominant diagonal.
  const matrix = classes.map((_, i) =>
    classes.map((_, j) => (i === j ? randInt(280, 4000) : randInt(0, 18)))
  )
  const importances = featureNames
    .map((name) => ({ feature: name, importance: round(randFloat(0.002, 0.12), 4) }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 20)
  return {
    modelName: 'Tidewatch XGBoost Classifier',
    version: 'v2.4.0',
    trainedOn: 'CICIDS2017 Dataset',
    overallAccuracy: round(randFloat(0.985, 0.999), 4),
    macroF1: round(randFloat(0.972, 0.991), 4),
    weightedF1: round(randFloat(0.983, 0.998), 4),
    averageInferenceTimeMs: round(randFloat(2.6, 4.6), 2),
    falsePositiveRate: round(randFloat(0.0002, 0.0009), 4),
    classes: perClass,
    features: importances,
    confusionMatrix: { labels: classes, matrix },
  }
}

// ─── Data generation (shared by live + dry-run) ──────────────────────────────
function generateDataset() {
  const now = Date.now()
  const windowMs = N_DAYS * 24 * 60 * 60 * 1000

  const flowRows = []
  const alertRows = []
  const reportRows = []

  const pickAttack = () => {
    let r = rng()
    for (const a of ATTACKS) {
      if (r < a.weight) return a
      r -= a.weight
    }
    return ATTACKS[0]
  }

  for (let i = 0; i < N_FLOWS; i++) {
    const isAttack = rng() > BENIGN_WEIGHT
    const flowId = randomUUID()
    const skew = Math.pow(rng(), 2)
    const ts = new Date(now - skew * windowMs)

    let flowData, prediction, srcIp

    if (isAttack) {
      const atk = pickAttack()
      flowData = attackFlow(atk)
      prediction = atk.label
      srcIp = atk.ip
      const alertId = randomUUID()
      alertRows.push({
        id: alertId,
        flow_id: flowId,
        attack_type: atk.label,
        severity: atk.severity,
        status: weightedStatus(atk.severity),
        created_at: ts.toISOString(),
      })
      reportRows.push({
        id: randomUUID(),
        ...makeAiReport(alertId, atk, { features: flowData.features, ts: ts.toISOString() }),
      })
    } else {
      flowData = benignFlow()
      prediction = 'BENIGN'
      srcIp = randomSrcIp()
    }

    flowRows.push({
      id: flowId,
      ts: ts.toISOString(),
      src_ip: srcIp,
      dst_ip: '192.168.10.1',
      src_port: randomSrcPort(),
      dst_port: flowData.features['Destination Port'],
      protocol:
        prediction === 'BENIGN'
          ? flowData.features['Destination Port'] === 53
            ? 'UDP'
            : 'TCP'
          : 'TCP',
      features: flowData.features,
      prediction,
      confidence: round(flowData.confidence, 4),
    })
  }

  return { flowRows, alertRows, reportRows }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const { flowRows, alertRows, reportRows } = generateDataset()

  if (DRY_RUN) {
    const classCounts = {}
    for (const f of flowRows) classCounts[f.prediction] = (classCounts[f.prediction] || 0) + 1
    console.log('\n[seed] DRY RUN — no database writes.')
    console.log(`       generated flows  : ${flowRows.length}`)
    console.log(`       generated alerts : ${alertRows.length}`)
    console.log(`       generated reports: ${reportRows.length}`)
    console.log('       sample flow      :', JSON.stringify(flowRows[0].features['Flow Packets/s']), 'pkts/s')
    console.log('       class breakdown  :', JSON.stringify(classCounts, null, 0))
    console.log('       feature count    :', Object.keys(flowRows[0].features).length)
    return
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl:
      DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : undefined,
  })

  console.log('[seed] Connecting to database…')
  await client.connect()
  const host = new URL(DATABASE_URL).host
  console.log(`[seed] Connected → ${host}`)

  // Verify schema exists.
  const { rows: tbl } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('flows','alerts','ai_reports','model_runs','chat_messages')`
  )
  const found = new Set(tbl.map((r) => r.table_name))
  const required = ['flows', 'alerts', 'ai_reports', 'model_runs']
  const missing = required.filter((t) => !found.has(t))
  if (missing.length) {
    throw new Error(
      `Missing tables: ${missing.join(', ')}. Run "alembic upgrade head" first.`
    )
  }

  if (RESET) {
    console.log('[seed] --reset → truncating existing data…')
    await client.query('TRUNCATE ai_reports, alerts, flows, model_runs RESTART IDENTITY CASCADE')
  } else {
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM flows')
    if (rows[0].n > 0) {
      console.log(`[seed] flows already has ${rows[0].n} rows. Use --reset to wipe first. Aborting.`)
      await client.end()
      return
    }
  }

  console.log(`[seed] Inserting ${flowRows.length} flows…`)
  await insertFlows(client, flowRows)

  console.log(`[seed] Inserting ${alertRows.length} alerts…`)
  await insertAlerts(client, alertRows)

  console.log(`[seed] Inserting ${reportRows.length} AI reports…`)
  await insertReports(client, reportRows)

  const metrics = makeModelMetrics()
  await client.query(
    `INSERT INTO model_runs (id, version, metrics, created_at) VALUES ($1,$2,$3,$4)`,
    [randomUUID(), metrics.version, JSON.stringify(metrics), new Date().toISOString()]
  )
  console.log('[seed] Inserted 1 model_run snapshot.')

  const { rows: sum } = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM flows)::int                      AS flows,
       (SELECT COUNT(*) FROM alerts)::int                     AS alerts,
       (SELECT COUNT(*) FROM ai_reports)::int                 AS reports,
       (SELECT COUNT(DISTINCT prediction) FROM flows
          WHERE prediction <> 'BENIGN')::int                  AS attack_classes`
  )
  const s = sum[0]
  console.log('\n[seed] Done ✓')
  console.log(`       flows         : ${s.flows}`)
  console.log(`       alerts        : ${s.alerts}`)
  console.log(`       ai_reports    : ${s.reports}`)
  console.log(`       attack classes: ${s.attack_classes}`)
  console.log('\n[seed] Start the API (uvicorn app.main:app --reload) and refresh the dashboard.')

  await client.end()
}

function weightedStatus(severity) {
  const r = rng()
  if (severity === 'critical') return r < 0.5 ? 'open' : r < 0.8 ? 'investigating' : 'resolved'
  return r < 0.35 ? 'open' : r < 0.6 ? 'investigating' : 'resolved'
}

// ─── Batched insert helpers (unnest for Postgres efficiency) ─────────────────
async function insertFlows(client, rows) {
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const params = []
    const tuples = batch.map((r, j) => {
      const b = j * 10
      params.push(r.id, r.ts, r.src_ip, r.dst_ip, r.src_port, r.dst_port, r.protocol, JSON.stringify(r.features), r.prediction, r.confidence)
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`
    })
    await client.query(
      `INSERT INTO flows (id, ts, src_ip, dst_ip, src_port, dst_port, protocol, features, prediction, confidence)
       VALUES ${tuples.join(',')}`,
      params
    )
  }
}

async function insertAlerts(client, rows) {
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const params = []
    const tuples = batch.map((r, j) => {
      const b = j * 6
      params.push(r.id, r.flow_id, r.attack_type, r.severity, r.status, r.created_at)
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`
    })
    await client.query(
      `INSERT INTO alerts (id, flow_id, attack_type, severity, status, created_at)
       VALUES ${tuples.join(',')}`,
      params
    )
  }
}

async function insertReports(client, rows) {
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const params = []
    const tuples = batch.map((r, j) => {
      const b = j * 7
      params.push(r.id, r.alertId, r.explanation, JSON.stringify(r.mitigation), r.severityScore, r.provider, r.model)
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7}, now())`
    })
    await client.query(
      `INSERT INTO ai_reports (id, alert_id, explanation, mitigation, severity_score, provider, model, created_at)
       VALUES ${tuples.join(',')}`,
      params
    )
  }
}

main().catch((err) => {
  console.error('\n[seed] FAILED:', err.message)
  process.exit(1)
})
