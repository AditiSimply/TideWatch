# Tidewatch — ML Network Intrusion Detection System

**Tidewatch** is an ML-based Network Intrusion Detection System (NIDS) dashboard that inspects bidirectional network flow telemetry in real time. Rather than relying on rigid static signatures or inspecting encrypted payload bodies, Tidewatch evaluates statistical packet arrival patterns, inter-arrival intervals, and bidirectional window sizes calibrated on the Canadian Institute for Cybersecurity **CICIDS2017** benchmark.

---

## Key Features

1. **Overview & Ingress Telemetry**:
   - Hero header with layered animated SVG sine waves gently drifting at differential speeds.
   - Live KPI stats strip: Active Ingress Flows, 3.8ms Mean Inference Latency, 0.03% False Positive Rate, 99.82% Ensemble F1-Score.

2. **Real-Time Dashboard**:
   - **KPI Row**: Total flows analyzed, Attacks detected, Attack flow ratio, and Average model confidence with smooth cubic count-up animations.
   - **Ingress Traffic & Threat Density Chart**: Time-series comparison of normal telemetry versus attack bursts with time-window filtering (15m, 1h, 6h, 24h).
   - **Attack Classification Donut**: Proportional breakdown of detected vectors (DDoS-LOIC, DoS-GoldenEye, PortScan, Botnet, Slowloris, Web Attacks).
   - **Top Adversary IPs**: Horizontal bar chart ranked by suspicious flow volume and threat score with quick filter chips.
   - **Live Incident Feed**: Real-time event stream with severity chips (Critical, High, Medium, Low), time-ago badges, and click-to-investigate triggers.

3. **Batch Telemetry Analysis (CSV Dropzone)**:
   - Drag-and-drop CSV upload conforming to CICIDS2017 flow headers (`Destination Port`, `Flow Duration`, `Flow Packets/s`, `Flow IAT Mean`, etc.).
   - **1-Click Pre-Calibrated Samples**: Instant test captures for DDoS-LOIC floods, SYN PortScan sweeps, and Benign HTTPS traffic.
   - Filterable results table with per-row predictions, confidence bars, anomaly indicators, and **CSV Export**.

4. **Alert Journal & Investigation Drawer**:
   - Filterable alerts table supporting status changes (`open`, `investigating`, `resolved`) and severity levels.
   - **Slide-Over Side Drawer**: Opens full network 5-tuple, CICIDS2017 extracted metrics, and an **AI SecOps Triage Report** detailing taxonomy, root-cause analysis, salient SHAP features, and copy-pasteable firewall commands (`iptables` and Snort rules).

5. **SecOps Reasoning Assistant**:
   - Chat interface for operators to query model decision rationale (*"Why was flow #89421 flagged?"*, *"Summarize network anomalies from the last hour"*).
   - Streaming token simulation with markdown rendering and copyable code blocks.

6. **Model Validation & Feature Importance**:
   - Interactive **Confusion Matrix Heatmap** displaying true vs predicted classes with cell hover drilldowns.
   - **Feature Importance Chart**: Gini and SHAP discriminative weights across the 78-dimensional vector space.
   - **Per-Class Metrics Table**: Precision, Recall, F1-Score, and ROC-AUC across all 10 CICIDS2017 classes.

7. **Live Traffic Simulation Engine**:
   - Navbar toggle switch to replay mock traffic every second.
   - Speed multipliers: `1x`, `2x`, `5x`.
   - **"Inject Threat"** button: Immediately triggers high-velocity anomaly bursts to test real-time alerts.

---

## Design System

- **Palette**: Warm off-white (`#FAFBF8`) base with pure white (`#FFFFFF`) cards. Greens reserved as accents: Deep Forest (`#0F3D2E`) for headings and text, Emerald (`#10B981`) for active/safe indicators, Mint (`#D1FAE5`) and Sage (`#A7C4B5`) for subtle highlights and wave gradients. Red and amber are strictly reserved for threat severity.
- **Background**: Multi-layered SVG sine waves (4 distinct layers) drifting horizontally at different speeds via CSS keyframes with a subtle vertical fade into white. Motion is automatically disabled if `prefers-reduced-motion` is set.
- **Typography**: Editorial serif display font (**Fraunces**) paired with **DM Sans** for UI elements and **JetBrains Mono** for IP addresses, ports, and metrics.
- **Rhythm**: Hand-built layout rhythm with thin 1px green-tinted borders (`#E2EBE5`), 2px hover lifts, and zero generic AI filler copy.

---

## Technology Stack

- **Framework**: [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Data Fetching & Cache**: [TanStack Query v5](https://tanstack.com/query)
- **Charts**: [Recharts v3](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **CSV Parsing**: [Papa Parse](https://www.papaparse.com/)

---

## Project Structure

```text
src/
├── components/
│   ├── alerts/
│   │   └── AlertDrawer.tsx         # Slide-over telemetry & AI report drawer
│   ├── charts/
│   │   ├── AttackTypeDonut.tsx     # Donut chart for attack taxonomy
│   │   ├── ConfusionMatrixHeatmap.tsx # Interactive confusion matrix
│   │   ├── FeatureImportanceChart.tsx # SHAP / Gini feature weights
│   │   ├── TopIpsBarChart.tsx      # Top adversary source IPs
│   │   └── TrafficLineChart.tsx    # Telemetry time series chart
│   ├── common/
│   │   ├── Drawer.tsx              # Accessible slide-over drawer
│   │   ├── EmptyState.tsx          # Polished empty state with action
│   │   ├── MarkdownView.tsx        # Markdown renderer with copyable code
│   │   ├── SeverityBadge.tsx       # Severity chip (Critical/High/Medium/Low)
│   │   ├── Skeleton.tsx            # Card and table loading skeletons
│   │   └── StatCard.tsx            # Editorial KPI card with count-up
│   └── layout/
│       ├── AppLayout.tsx           # Shell wrapping navbar, waves, and footer
│       ├── BackgroundWaves.tsx     # Multi-layered animated SVG sine waves
│       ├── Footer.tsx              # Editorial dataset and model footer
│       └── Navbar.tsx              # Sticky header with simulation controls
├── hooks/
│   ├── useCountUp.ts               # Smooth numeric counter with cubic easing
│   ├── useLiveFeed.ts              # WebSocket/SSE hook with simulation fallback
│   └── useSimulation.tsx           # Context & state for traffic simulator
├── lib/
│   ├── api.ts                      # Typed API layer (mocked / FastAPI ready)
│   ├── mockData.ts                 # CICIDS2017 flows, alerts, and sample CSVs
│   ├── simulation.ts               # High-fidelity traffic generator engine
│   └── utils.ts                    # Formatting and severity helpers
├── pages/
│   ├── AlertsPage.tsx              # Incidents log with status filters
│   ├── AnalyzePage.tsx             # CSV drag-and-drop & batch classification
│   ├── AssistantPage.tsx           # SecOps AI reasoning chat interface
│   ├── DashboardPage.tsx           # Operations dashboard & live feed
│   ├── LandingPage.tsx             # Editorial hero & architectural pitch
│   ├── ModelPage.tsx               # Classifier specs, confusion matrix, SHAP
│   └── NotFoundPage.tsx            # 404 handler
├── types/
│   └── index.ts                    # Flow, Alert, ModelMetrics, AiReport types
├── App.tsx                         # QueryClient & route tree configuration
├── index.css                       # Design tokens, typography & wave animations
└── main.tsx                        # Application mount entrypoint
```

---

## Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open your browser and navigate to: `http://localhost:5173/`

### 3. Production Build & Preview
```bash
npm run build
npm run preview
```

---

## Swapping with a FastAPI Backend

All API calls and streaming feeds are cleanly decoupled behind `src/lib/api.ts` and `src/hooks/useLiveFeed.ts`.

To connect a live FastAPI or backend service, create a `.env` file in the root directory:

```env
# URL of your FastAPI backend service
VITE_API_URL=http://localhost:8000

# Optional: Real-time WebSocket or Server-Sent Events endpoint
VITE_WS_URL=ws://localhost:8000/api/stream/ws
VITE_SSE_URL=http://localhost:8000/api/stream/sse
```

When `VITE_API_URL` is set, `src/lib/api.ts` automatically dispatches requests to the following endpoints, falling back to local simulation if the backend is unreachable:

| Endpoint | Method | Response Type | Description |
|---|---|---|---|
| `/api/kpis` | `GET` | `KpiSummary` | Aggregate telemetry KPIs |
| `/api/traffic/series?range={range}` | `GET` | `TrafficDataPoint[]` | Normal vs attack flow time-series |
| `/api/attacks/distribution` | `GET` | `AttackDistribution[]` | Attack class breakdown |
| `/api/traffic/top-ips` | `GET` | `TopIpMetric[]` | Top malicious source IPs |
| `/api/flows?limit=50&offset=0` | `GET` | `{ flows: Flow[], total: number }` | Flow records |
| `/api/alerts?status={s}&severity={v}` | `GET` | `Alert[]` | Security incident alerts |
| `/api/alerts/{id}` | `GET` | `Alert` (with `aiReport`) | Single incident with AI report |
| `/api/alerts/{id}/status` | `PATCH` | `{ success: boolean }` | Update incident status |
| `/api/analyze/csv` | `POST` | `PredictionResult[]` | Batch inference on raw CSV |
| `/api/model/metrics` | `GET` | `ModelMetrics` | Confusion matrix, F1, SHAP weights |

---

## Backend — FastAPI + ML Engine

### Backend Project Structure

```text
app/
├── agents/
│   ├── chat_agent.py     # ReAct chat agent with streaming & fallback
│   ├── fallbacks.py      # Rule-based triage heuristics (no LLM required)
│   ├── state.py          # LangGraph TypedDict state definitions
│   ├── tools.py          # Safe ORM tools: query_flows, summarize_window, knowledge
│   └── triage.py         # LangGraph triage workflow (classify → enrich → explain → mitigate → score → persist)
├── api/
│   ├── deps.py           # Shared FastAPI dependencies (DB session, predictor)
│   └── routes/
│       ├── alerts.py     # GET /alerts, PATCH status, POST /{id}/analyze (LangGraph triage)
│       ├── chat.py       # POST /chat (SSE token stream via chat agent)
│       ├── flows.py      # GET /flows, GET /flows/{id}
│       ├── model.py      # GET /model/metrics
│       ├── predict.py    # POST /predict, POST /predict/batch (CSV upload)
│       ├── stats.py      # GET /stats/overview, /timeseries, /top-sources, /attack-distribution
│       └── stream.py     # GET /stream/traffic (SSE live replay)
├── core/
│   ├── config.py         # Pydantic Settings (DATABASE_URL, GROQ_API_KEY, etc.)
│   └── logging.py        # Structured JSON logging
├── db/
│   ├── base.py           # Imports all models for Alembic autogenerate
│   └── session.py        # Async SQLAlchemy engine (PostgreSQL/Neon + SQLite dev)
├── ml/
│   └── predictor.py      # Singleton predictor: load artifacts, validate columns, infer
├── models/               # SQLAlchemy ORM models
│   ├── alert.py
│   ├── ai_report.py
│   ├── base.py
│   ├── chat.py
│   ├── flow.py
│   └── model_run.py
├── schemas/              # Pydantic v2 request/response schemas
│   ├── agent.py
│   ├── alert.py
│   ├── chat.py
│   ├── flow.py
│   ├── model.py
│   ├── predict.py
│   └── stats.py
└── main.py               # FastAPI app entrypoint, lifespan, CORS, health check

ml/
└── train.py              # Model training script (RandomForest + XGBoost, CICIDS2017-style)

artifacts/                # Auto-generated ML artifacts (git-ignored)
├── model.joblib
├── scaler.joblib
├── label_encoder.joblib
├── features.json
├── metrics.json
└── test_samples.csv

alembic/
├── env.py
├── script.py.mako
└── versions/
    └── 001_initial_schema.py

tests/
├── conftest.py           # Async SQLite test DB + httpx AsyncClient fixtures
├── test_predictor.py     # Predictor unit tests
├── test_batch_endpoint.py # Integration tests: /predict, /predict/batch, /health
└── test_agent.py         # Agent tests: triage fallback, chat fallback, tools
```

---

### Backend Quick-Start

#### 1. Create and Activate Virtual Environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate
```

#### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

#### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon pooled URL (`postgresql://...?sslmode=require`) or `sqlite+aiosqlite:///./tidewatch.db` |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com/keys) — optional, rule-based fallbacks activate if unset |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. `http://localhost:5173`) |

#### 4. Train the ML Model

Generates `artifacts/model.joblib`, `scaler.joblib`, `label_encoder.joblib`, `features.json`, `metrics.json`, and `test_samples.csv`.

```bash
python ml/train.py
```

This runs automatically at API startup if `artifacts/model.joblib` is missing.

#### 5. Apply Database Migrations

```bash
alembic upgrade head
```

#### 6. Start the API Server

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: `http://localhost:8000/docs`

---

### API Endpoints Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check: DB ping, ML engine status |
| `POST` | `/api/v1/predict` | Single flow classification |
| `POST` | `/api/v1/predict/batch` | CSV file batch classification |
| `GET` | `/api/v1/flows` | Paginated flow records |
| `GET` | `/api/v1/flows/{id}` | Single flow detail |
| `GET` | `/api/v1/alerts` | Filterable alert list |
| `PATCH` | `/api/v1/alerts/{id}/status` | Update alert status |
| `POST` | `/api/v1/alerts/{id}/analyze` | Trigger LangGraph triage |
| `GET` | `/api/v1/stats/overview` | Aggregate KPIs |
| `GET` | `/api/v1/stats/timeseries` | Traffic time series |
| `GET` | `/api/v1/stats/top-sources` | Top attack source IPs |
| `GET` | `/api/v1/stats/attack-distribution` | Attack class proportions |
| `GET` | `/api/v1/model/metrics` | Confusion matrix, F1, feature importances |
| `GET` | `/api/v1/stream/traffic` | SSE: live flow replay |
| `POST` | `/api/v1/chat` | SSE: streaming chat with ReAct agent |

---

### Running Tests

```bash
pytest tests/ -v
```

Tests run entirely against an in-memory SQLite database and do not require a live database or Groq API key. The ML predictor is invoked from locally generated artifacts.

---

### Docker

```bash
# Build and run
docker compose up --build

# API available at http://localhost:8000
# Frontend available at http://localhost:5173
```

The `Dockerfile` automatically runs `python ml/train.py` during build so the image ships with pre-generated artifacts. `alembic upgrade head` runs at container startup before Uvicorn is launched.

---

### Neon Postgres Setup

1. Create a free project at [neon.tech](https://neon.tech)
2. Go to **Connection Details** → choose **Pooled connection**
3. Copy the connection string and set it as `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> **Note**: Use `postgresql+asyncpg://` (not `postgres://`) for SQLAlchemy async compatibility.
