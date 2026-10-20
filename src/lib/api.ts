import type {
  Flow,
  Alert,
  AlertStatus,
  ModelMetrics,
  TrafficDataPoint,
  AttackDistribution,
  TopIpMetric,
  KpiSummary,
  PredictionResult,
  AttackClass,
  Severity,
  LLMStatusResponse,
  AiReport,
} from '@/types'
import {
  TRAFFIC_TIME_SERIES,
  ATTACK_DISTRIBUTION,
  TOP_MALICIOUS_IPS,
  MODEL_METRICS,
  INITIAL_AI_REPORTS,
} from './mockData'
import { simulationEngine } from './simulation'
import { getSeverityForAttack } from './utils'
import { handleApiError } from '@/components/common/Toast'
import Papa from 'papaparse'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '')
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

/**
 * Standard fetch wrapper with automatic error envelope extraction
 * and Toast notification integration.
 */
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(options.headers || {})

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(url, { ...options, headers })
  } catch (netErr) {
    handleApiError(netErr, `Network error reaching ${url}`)
    throw netErr
  }

  if (!res.ok) {
    let errorData: unknown
    try {
      errorData = await res.json()
    } catch {
      errorData = await res.text()
    }
    handleApiError(errorData, `HTTP ${res.status} from ${path}`)
    const errObj = new Error(
      typeof errorData === 'object' && errorData !== null
        ? JSON.stringify(errorData)
        : String(errorData || res.statusText)
    )
    ;(errObj as any).status = res.status
    ;(errObj as any).data = errorData
    throw errObj
  }

  return (await res.json()) as T
}

export const api = {
  // ── KPI Summary ─────────────────────────────────────────────────────────────
  async getKpis(): Promise<KpiSummary> {
    if (!USE_MOCKS) {
      try {
        const res = await apiFetch<any>('/stats/overview')
        return {
          totalFlows: res.totalFlows ?? res.total_flows ?? 0,
          attacksDetected: res.attacksDetected ?? res.attacks_detected ?? 0,
          attackRate: res.attackRate ?? res.attack_rate ?? 0,
          avgConfidence: res.avgConfidence ?? res.avg_confidence ?? 0.985,
          activeThreatCount: res.activeThreats ?? res.active_threats ?? 0,
          flowsLastMinute: res.flowsLastMinute ?? res.flows_last_minute ?? 0,
        }
      } catch (e) {
        console.warn('Backend unavailable for KPIs, using simulation:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 60))
    return simulationEngine.getKpis()
  },

  // ── Traffic Time Series ─────────────────────────────────────────────────────
  async getTrafficTimeSeries(range: string = '1h'): Promise<TrafficDataPoint[]> {
    if (!USE_MOCKS) {
      try {
        const points = await apiFetch<TrafficDataPoint[]>(`/stats/timeseries?range_window=${range}`)
        if (Array.isArray(points) && points.length > 0) {
          return points
        }
      } catch (e) {
        console.warn('Backend unavailable for timeseries, using mock series:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 60))
    return TRAFFIC_TIME_SERIES
  },

  // ── Attack Distribution (Donut Chart) ───────────────────────────────────────
  async getAttackDistribution(): Promise<AttackDistribution[]> {
    if (!USE_MOCKS) {
      try {
        const dist = await apiFetch<AttackDistribution[]>('/stats/attack-distribution')
        if (Array.isArray(dist) && dist.length > 0) {
          return dist
        }
      } catch (e) {
        console.warn('Backend unavailable for attack distribution, using mock:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 50))
    return ATTACK_DISTRIBUTION
  },

  // ── Top Malicious Source IPs ────────────────────────────────────────────────
  async getTopIps(): Promise<TopIpMetric[]> {
    if (!USE_MOCKS) {
      try {
        const top = await apiFetch<TopIpMetric[]>('/stats/top-sources')
        if (Array.isArray(top) && top.length > 0) {
          return top.map((t: any) => ({
            ip: t.ip,
            country: t.country || 'External Ingress',
            flowsCount: t.flowsCount ?? t.flows_count ?? 0,
            threatScore: t.threatScore ?? t.threat_score ?? 85,
            primaryAttack: (t.primaryAttack ?? t.primary_attack ?? 'DDoS') as AttackClass,
            lastSeen: t.lastSeen ?? t.last_seen ?? '1m ago',
          }))
        }
      } catch (e) {
        console.warn('Backend unavailable for top IPs, using mock:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 50))
    return TOP_MALICIOUS_IPS
  },

  // ── Flows List ──────────────────────────────────────────────────────────────
  async getFlows(params?: {
    limit?: number
    offset?: number
    classFilter?: string
  }): Promise<{ flows: Flow[]; total: number }> {
    if (!USE_MOCKS) {
      try {
        const q = new URLSearchParams()
        if (params?.limit) q.set('limit', String(params.limit))
        if (params?.offset) q.set('offset', String(params.offset))
        if (params?.classFilter && params.classFilter !== 'ALL') {
          q.set('prediction', params.classFilter)
        }
        const data = await apiFetch<any[]>(`/flows?${q.toString()}`)
        if (Array.isArray(data)) {
          const flows: Flow[] = data.map((f) => ({
            id: String(f.id),
            timestamp: f.ts || f.timestamp || new Date().toISOString(),
            srcIp: f.srcIp || f.src_ip || '192.168.10.50',
            srcPort: f.srcPort ?? f.src_port ?? 54128,
            dstIp: f.dstIp || f.dst_ip || '192.168.10.1',
            dstPort: f.dstPort ?? f.dst_port ?? 80,
            protocol: f.protocol || 'TCP',
            prediction: (f.prediction || 'BENIGN') as AttackClass,
            confidence: Number(f.confidence || 0.98),
            severity: getSeverityForAttack((f.prediction || 'BENIGN') as AttackClass),
            features: f.features || null,
          }))
          return { flows, total: flows.length }
        }
      } catch (e) {
        console.warn('Backend unavailable for flows, using simulation flows:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 60))
    let flows = simulationEngine.getLatestFlows()
    if (params?.classFilter && params.classFilter !== 'ALL') {
      flows = flows.filter((f) => f.prediction === params.classFilter)
    }
    const offset = params?.offset || 0
    const limit = params?.limit || 50
    return {
      flows: flows.slice(offset, offset + limit),
      total: flows.length,
    }
  },

  // ── Alerts List ─────────────────────────────────────────────────────────────
  async getAlerts(params?: {
    status?: string
    severity?: string
    search?: string
    page?: number
    pageSize?: number
  }): Promise<Alert[]> {
    if (!USE_MOCKS) {
      try {
        const q = new URLSearchParams()
        if (params?.status && params.status !== 'all') q.set('status', params.status)
        if (params?.severity && params.severity !== 'all') q.set('severity', params.severity)
        if (params?.search) q.set('q', params.search)
        if (params?.page) q.set('page', String(params.page))
        if (params?.pageSize) q.set('pageSize', String(params.pageSize))

        const res = await apiFetch<any>(`/alerts?${q.toString()}`)
        const items = res.items || res
        if (Array.isArray(items)) {
          return items.map((a: any) => {
            const rawFlow = a.flow || {}
            const attackType = (a.attackType || a.attack_type || 'DDoS') as AttackClass
            const flow: Flow = {
              id: String(rawFlow.id || a.flowId || a.flow_id || a.id),
              timestamp: rawFlow.ts || a.createdAt || a.created_at || new Date().toISOString(),
              srcIp: rawFlow.srcIp || rawFlow.src_ip || a.srcIp || '192.168.10.50',
              srcPort: rawFlow.srcPort ?? rawFlow.src_port ?? 54128,
              dstIp: rawFlow.dstIp || rawFlow.dst_ip || '192.168.10.1',
              dstPort: rawFlow.dstPort ?? rawFlow.dst_port ?? 80,
              protocol: rawFlow.protocol || 'TCP',
              prediction: attackType,
              confidence: Number(rawFlow.confidence || a.confidence || 0.98),
              severity: (a.severity || getSeverityForAttack(attackType)) as Severity,
              flowDuration: 25000,
              totalFwdPackets: 12,
              totalBwdPackets: 8,
              totalLengthFwdPackets: 4500,
              totalLengthBwdPackets: 7200,
              flowBytesPerSec: 45000,
              flowPacketsPerSec: 1500,
              flowIATMean: 120,
              synFlagCount: 1,
              rstFlagCount: 0,
              ackFlagCount: 1,
              initWinBytesForward: 65535,
            }

            return {
              id: String(a.id),
              flowId: String(a.flowId || a.flow_id || flow.id),
              timestamp: a.createdAt || a.created_at || a.timestamp || new Date().toISOString(),
              attackType,
              severity: (a.severity || getSeverityForAttack(attackType)) as Severity,
              srcIp: flow.srcIp,
              srcPort: flow.srcPort,
              dstIp: flow.dstIp,
              dstPort: flow.dstPort,
              protocol: flow.protocol,
              confidence: Number(a.confidence || flow.confidence || 0.98),
              status: (a.status || 'open') as AlertStatus,
              summary: `${attackType} activity targeted at port ${flow.dstPort}`,
              flow,
              provider: a.aiReports?.[0]?.provider || null,
              model: a.aiReports?.[0]?.model || null,
            }
          })
        }
      } catch (e) {
        console.warn('Backend unavailable for alerts, using simulation alerts:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 60))
    let alerts = simulationEngine.getLatestAlerts()
    if (params?.status && params.status !== 'all') {
      alerts = alerts.filter((a) => a.status === params.status)
    }
    if (params?.severity && params.severity !== 'all') {
      alerts = alerts.filter((a) => a.severity === params.severity)
    }
    if (params?.search) {
      const query = params.search.toLowerCase()
      alerts = alerts.filter(
        (a) =>
          a.srcIp.toLowerCase().includes(query) ||
          a.dstIp.toLowerCase().includes(query) ||
          a.attackType.toLowerCase().includes(query)
      )
    }
    return alerts
  },

  // ── Single Alert Detail & AI Triage ─────────────────────────────────────────
  async getAlertById(id: string): Promise<Alert | null> {
    if (!USE_MOCKS) {
      try {
        const a = await apiFetch<any>(`/alerts/${id}`)
        if (a) {
          const rawFlow = a.flow || {}
          const attackType = (a.attackType || a.attack_type || 'DDoS') as AttackClass
          const flow: Flow = {
            id: String(rawFlow.id || a.flowId || a.flow_id || id),
            timestamp: rawFlow.ts || a.createdAt || a.created_at || new Date().toISOString(),
            srcIp: rawFlow.srcIp || rawFlow.src_ip || '192.168.10.50',
            srcPort: rawFlow.srcPort ?? rawFlow.src_port ?? 54128,
            dstIp: rawFlow.dstIp || rawFlow.dst_ip || '192.168.10.1',
            dstPort: rawFlow.dstPort ?? rawFlow.dst_port ?? 80,
            protocol: rawFlow.protocol || 'TCP',
            prediction: attackType,
            confidence: Number(rawFlow.confidence || a.confidence || 0.98),
            severity: (a.severity || getSeverityForAttack(attackType)) as Severity,
            flowDuration: Number(rawFlow.features?.['Flow Duration'] || 25000),
            totalFwdPackets: Number(rawFlow.features?.['Total Fwd Packets'] || 12),
            totalBwdPackets: Number(rawFlow.features?.['Total Backward Packets'] || 8),
            totalLengthFwdPackets: Number(rawFlow.features?.['Total Length of Fwd Packets'] || 4500),
            totalLengthBwdPackets: Number(rawFlow.features?.['Total Length of Bwd Packets'] || 7200),
            flowBytesPerSec: Number(rawFlow.features?.['Flow Bytes/s'] || 45000),
            flowPacketsPerSec: Number(rawFlow.features?.['Flow Packets/s'] || 1500),
            flowIATMean: Number(rawFlow.features?.['Flow IAT Mean'] || 120),
            synFlagCount: Number(rawFlow.features?.['SYN Flag Count'] || 1),
            rstFlagCount: Number(rawFlow.features?.['RST Flag Count'] || 0),
            ackFlagCount: Number(rawFlow.features?.['ACK Flag Count'] || 1),
            initWinBytesForward: Number(rawFlow.features?.['Init_Win_bytes_forward'] || 65535),
          }

          let aiReport: AiReport | undefined
          if (a.aiReports && a.aiReports.length > 0) {
            const rep = a.aiReports[0]
            aiReport = {
              id: rep.id,
              generatedAt: rep.createdAt || rep.created_at || new Date().toISOString(),
              modelName: rep.model ? `${rep.provider} (${rep.model})` : 'Tidewatch Agent',
              attackTaxonomy: rep.mitigation?.attack_taxonomy || `Anomaly: ${attackType}`,
              rootCauseAnalysis: rep.explanation || 'Analyzed via SecOps triage workflow.',
              keyFeatures: rep.mitigation?.salient_features?.map((sf: any) => ({
                feature: sf.feature,
                value: String(sf.observedValue ?? sf.observed_value ?? ''),
                benchmark: sf.benchmark || 'Normal baseline',
                contribution: sf.contribution || 'Elevated',
              })),
              impactAssessment: rep.mitigation?.impact_assessment || 'Potential service disruption.',
              recommendedMitigation: rep.mitigation?.mitigations?.map((m: any) => ({
                step: m.step,
                iptablesRule: m.iptablesRule || m.iptables_rule,
                snortRule: m.snortRule || m.snort_rule,
                priority: m.priority || 'immediate',
              })),
              provider: rep.provider,
              model: rep.model,
            }
          }

          return {
            id: String(a.id),
            flowId: String(a.flowId || a.flow_id || flow.id),
            timestamp: a.createdAt || a.created_at || new Date().toISOString(),
            attackType,
            severity: (a.severity || getSeverityForAttack(attackType)) as Severity,
            srcIp: flow.srcIp,
            srcPort: flow.srcPort,
            dstIp: flow.dstIp,
            dstPort: flow.dstPort,
            protocol: flow.protocol,
            confidence: Number(a.confidence || flow.confidence || 0.98),
            status: (a.status || 'open') as AlertStatus,
            summary: `${attackType} detected on ${flow.dstIp}:${flow.dstPort}`,
            flow,
            aiReport,
            provider: aiReport?.provider || null,
            model: aiReport?.model || null,
          }
        }
      } catch (e) {
        console.warn('Backend alert lookup failed, falling back to local simulation:', e)
      }
    }

    const alerts = simulationEngine.getLatestAlerts()
    const alert = alerts.find((a) => a.id === id) || null
    if (alert && !alert.aiReport) {
      alert.aiReport = INITIAL_AI_REPORTS[id]
    }
    return alert
  },

  // ── Update Alert Status ─────────────────────────────────────────────────────
  async updateAlertStatus(id: string, status: AlertStatus): Promise<boolean> {
    if (!USE_MOCKS) {
      try {
        await apiFetch(`/alerts/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
        return true
      } catch (e) {
        console.warn('Backend updateAlertStatus failed, updating locally:', e)
      }
    }
    simulationEngine.updateAlertStatus(id, status)
    return true
  },

  // ── Trigger LangGraph SecOps Triage on Alert ─────────────────────────────────
  async analyzeAlert(id: string): Promise<AiReport> {
    if (!USE_MOCKS) {
      try {
        const res = await apiFetch<any>(`/alerts/${id}/analyze`, { method: 'POST' })
        return {
          id: res.id,
          alertId: res.alertId ?? res.alert_id,
          generatedAt: res.createdAt ?? res.created_at ?? new Date().toISOString(),
          modelName: res.model ? `${res.provider} (${res.model})` : 'LangGraph SecOps Agent',
          attackTaxonomy: res.attackTaxonomy ?? res.attack_taxonomy ?? 'Classified Threat',
          rootCauseAnalysis: res.rootCauseAnalysis ?? res.root_cause_analysis ?? '',
          salientFeatures: res.salientFeatures ?? res.salient_features ?? [],
          keyFeatures: (res.salientFeatures ?? res.salient_features ?? []).map((sf: any) => ({
            feature: sf.feature,
            value: String(sf.observedValue ?? sf.observed_value ?? ''),
            benchmark: sf.benchmark || 'Baseline',
            contribution: sf.contribution || 'High',
          })),
          impactAssessment: res.impactAssessment ?? res.impact_assessment ?? '',
          recommendedMitigation: (res.mitigations ?? []).map((m: any) => ({
            step: m.step,
            iptablesRule: m.iptablesRule ?? m.iptables_rule,
            snortRule: m.snortRule ?? m.snort_rule,
            priority: m.priority || 'immediate',
          })),
          mitigations: res.mitigations ?? [],
          severityScore: res.severityScore ?? res.severity_score ?? 8.5,
          provider: res.provider,
          model: res.model,
        }
      } catch (e) {
        console.warn('AI analysis on alert failed, generating local fallback report:', e)
      }
    }

    await new Promise((r) => setTimeout(r, 600))
    return {
      generatedAt: new Date().toISOString(),
      modelName: 'Tidewatch Heuristic Fallback v2.4',
      attackTaxonomy: 'MITRE ATT&CK: Denial of Service / Scanning',
      rootCauseAnalysis: 'Extreme packet frequency anomaly detected diverging by >3.8 std deviations from baseline profile.',
      keyFeatures: [
        { feature: 'Flow Packets/s', value: '34,430 pkts/s', benchmark: '120-400 pkts/s', contribution: '+34.2%' },
        { feature: 'Flow IAT Mean', value: '28.4 µs', benchmark: '8,400 µs', contribution: '+28.5%' },
      ],
      impactAssessment: 'High probability of egress bottleneck or connection backlog starvation.',
      recommendedMitigation: [
        { step: 'Drop attacker IP on ingress edge firewall', iptablesRule: 'iptables -I INPUT -p tcp --dport 80 -j DROP', priority: 'immediate' },
      ],
      provider: 'rule-based',
      model: 'fallback-heuristics',
    }
  },

  // ── Model Evaluation Metrics ────────────────────────────────────────────────
  async getModelMetrics(): Promise<ModelMetrics> {
    if (!USE_MOCKS) {
      try {
        const res = await apiFetch<any>('/model/metrics')
        if (res) {
          return {
            version: res.version || 'v2.4.0',
            modelName: res.modelName ?? res.model_name ?? 'Tidewatch Multi-Stage Ensemble',
            trainedOn: res.trainedOn ?? res.trained_on ?? 'CICIDS2017 Dataset',
            lastUpdated: 'Real-time',
            overallAccuracy: res.accuracy ?? res.overallAccuracy ?? 0.9984,
            accuracy: res.accuracy ?? 0.9984,
            macroF1: res.macroF1 ?? res.macro_f1 ?? 0.9841,
            weightedF1: res.weightedF1 ?? res.weighted_f1 ?? 0.9982,
            averageInferenceTimeMs: res.avgInferenceTimeMs ?? res.avg_inference_time_ms ?? 3.8,
            avgInferenceTimeMs: res.avgInferenceTimeMs ?? res.avg_inference_time_ms ?? 3.8,
            falsePositiveRate: res.falsePositiveRate ?? res.false_positive_rate ?? 0.0003,
            classes: (res.perClass ?? res.per_class ?? []).map((c: any) => ({
              className: (c.className ?? c.class_name) as AttackClass,
              precision: c.precision ?? 0.98,
              recall: c.recall ?? 0.98,
              f1Score: c.f1Score ?? c.f1_score ?? 0.98,
              support: c.support ?? 1000,
              rocAuc: c.rocAuc ?? c.roc_auc ?? 0.99,
            })),
            features: (res.featureImportance ?? res.feature_importance ?? []).map((f: any) => ({
              feature: f.feature,
              displayName: f.feature,
              importance: f.importance ?? 0.1,
              shapImpact: 'high_fwd',
              description: 'Gradient boosted split attribution',
            })),
            confusionMatrix: res.confusionMatrix ?? res.confusion_matrix ?? MODEL_METRICS.confusionMatrix,
          }
        }
      } catch (e) {
        console.warn('Backend unavailable for model metrics, using mock:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 60))
    return MODEL_METRICS
  },

  // ── LLM Status & Switching ──────────────────────────────────────────────────
  async getLlmStatus(): Promise<LLMStatusResponse> {
    if (!USE_MOCKS) {
      try {
        return await apiFetch<LLMStatusResponse>('/llm/status')
      } catch (e) {
        console.warn('Could not fetch LLM status:', e)
      }
    }
    return {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      healthy: true,
      nativeToolCalling: true,
      fallbackChain: ['groq', 'ollama', 'huggingface', 'rule_based'],
    }
  },

  async switchLlmProvider(provider: string): Promise<LLMStatusResponse> {
    return await apiFetch<LLMStatusResponse>('/llm/provider', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    })
  },

  // ── Stream Control (Simulation Replay State) ─────────────────────────────────
  async controlStream(action: 'start' | 'stop' | 'reset'): Promise<{ status: string }> {
    if (!USE_MOCKS) {
      try {
        return await apiFetch<{ status: string }>('/stream/control', {
          method: 'POST',
          body: JSON.stringify({ action }),
        })
      } catch (e) {
        console.warn('Failed to send stream control to backend:', e)
      }
    }
    if (action === 'start' || action === 'reset') {
      simulationEngine.start()
    } else {
      simulationEngine.stop()
    }
    return { status: action === 'stop' ? 'stopped' : 'running' }
  },

  // ── Sample CSV Download ─────────────────────────────────────────────────────
  async downloadSampleCsv(): Promise<void> {
    const url = `${API_BASE_URL}/predict/sample`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = 'tidewatch_sample_flows.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (e) {
      handleApiError(e, 'Failed to download sample CSV from backend.')
      throw e
    }
  },

  // ── Batch CSV Multipart Upload ──────────────────────────────────────────────
  async uploadCsvBatch(
    file: File | Blob,
    filename = 'uploaded_flows.csv'
  ): Promise<{ results: PredictionResult[]; summary: { total: number; attacks: number; benign: number } }> {
    if (!USE_MOCKS) {
      const formData = new FormData()
      formData.append('file', file, filename)

      const res = await apiFetch<any>('/predict/batch', {
        method: 'POST',
        body: formData,
      })

      const rows: any[] = res.results || res.items || []
      const results: PredictionResult[] = rows.map((r) => {
        const attack = (r.prediction || 'BENIGN') as AttackClass
        const flow: Flow = {
          id: String(r.flowId || r.flow_id || `batch-${r.rowId ?? r.row_id}`),
          timestamp: new Date().toISOString(),
          srcIp: r.srcIp || r.src_ip || '192.168.10.50',
          srcPort: r.srcPort ?? r.src_port ?? 54128,
          dstIp: r.dstIp || r.dst_ip || '192.168.10.1',
          dstPort: r.dstPort ?? r.dst_port ?? 80,
          protocol: r.protocol || 'TCP',
          prediction: attack,
          confidence: Number(r.confidence || 0.98),
          severity: getSeverityForAttack(attack),
        }

        return {
          rowId: Number(r.rowId ?? r.row_id ?? 1),
          flow,
          prediction: attack,
          confidence: Number(r.confidence || 0.98),
          severity: getSeverityForAttack(attack),
          isAnomaly: Boolean(r.isAnomaly ?? r.is_anomaly),
        }
      })

      const summary = res.summary || {}
      return {
        results,
        summary: {
          total: summary.totalRows ?? summary.total_rows ?? results.length,
          attacks: summary.attacksCount ?? summary.attacks_count ?? results.filter((x) => x.isAnomaly).length,
          benign: summary.benignCount ?? summary.benign_count ?? results.filter((x) => !x.isAnomaly).length,
        },
      }
    }

    // Local client-side PapaParse inference fallback
    const text = typeof (file as any).text === 'function' ? await (file as any).text() : ''
    return await this.analyzeCsv(text)
  },

  // ── CSV Analysis Client Fallback ─────────────────────────────────────────────
  async analyzeCsv(
    csvContent: string
  ): Promise<{ results: PredictionResult[]; summary: { total: number; attacks: number; benign: number } }> {
    if (!USE_MOCKS) {
      try {
        const blob = new Blob([csvContent], { type: 'text/csv' })
        return await this.uploadCsvBatch(blob, 'analyzed_flows.csv')
      } catch (e) {
        console.warn('Backend multipart upload failed, running local parse fallback:', e)
      }
    }

    await new Promise((r) => setTimeout(r, 200))
    const parsed = Papa.parse<Record<string, string>>(csvContent.trim(), {
      header: true,
      skipEmptyLines: true,
    })

    const results: PredictionResult[] = []
    let attackCount = 0
    let benignCount = 0

    parsed.data.forEach((row, index) => {
      const dstPort = parseInt(row['Destination Port'] || row['dst_port'] || '80', 10)
      const flowDuration = parseFloat(row['Flow Duration'] || row['flow_duration'] || '25000')
      const flowPktsPerSec = parseFloat(row['Flow Packets/s'] || row['flow_pkts_s'] || '500')
      const flowIATMean = parseFloat(row['Flow IAT Mean'] || row['flow_iat_mean'] || '1200')
      const synFlag = parseInt(row['SYN Flag Count'] || '0', 10)
      const rstFlag = parseInt(row['RST Flag Count'] || '0', 10)
      const srcIp = row['Source IP'] || `192.168.10.${50 + (index % 40)}`
      const dstIp = row['Destination IP'] || '192.168.10.1'

      let prediction: AttackClass = 'BENIGN'
      let confidence = 0.985 + Math.random() * 0.014

      if (flowPktsPerSec > 20000 || (dstPort === 80 && flowIATMean < 50)) {
        prediction = 'DDoS-LOIC'
        confidence = 0.998
      } else if (flowDuration < 300 && rstFlag >= 1) {
        prediction = 'PortScan'
        confidence = 0.991
      } else if (dstPort === 8080 && flowDuration > 200000) {
        prediction = 'DoS-GoldenEye'
        confidence = 0.974
      } else if (dstPort === 6667) {
        prediction = 'Botnet'
        confidence = 0.963
      } else if (flowPktsPerSec > 5000) {
        prediction = 'DoS-Slowloris'
        confidence = 0.968
      }

      const severity: Severity = getSeverityForAttack(prediction)
      const isAnomaly = prediction !== 'BENIGN'
      if (isAnomaly) attackCount++
      else benignCount++

      const flow: Flow = {
        id: `csv-flw-${index + 1}`,
        timestamp: new Date().toISOString(),
        srcIp,
        srcPort: 49152 + (index % 1000),
        dstIp,
        dstPort,
        protocol: dstPort === 53 ? 'UDP' : 'TCP',
        flowDuration,
        totalFwdPackets: parseInt(row['Total Fwd Packets'] || '10', 10),
        totalBwdPackets: parseInt(row['Total Backward Packets'] || '8', 10),
        totalLengthFwdPackets: parseInt(row['Total Length of Fwd Packets'] || '4500', 10),
        totalLengthBwdPackets: parseInt(row['Total Length of Bwd Packets'] || '7200', 10),
        flowBytesPerSec: parseFloat(row['Flow Bytes/s'] || '45000'),
        flowPacketsPerSec: flowPktsPerSec,
        flowIATMean,
        synFlagCount: synFlag,
        rstFlagCount: rstFlag,
        ackFlagCount: 1,
        initWinBytesForward: parseInt(row['Init_Win_bytes_forward'] || '65535', 10),
        prediction,
        confidence,
        severity,
      }

      results.push({
        rowId: index + 1,
        flow,
        prediction,
        confidence,
        severity,
        isAnomaly,
      })
    })

    return {
      results,
      summary: {
        total: results.length,
        attacks: attackCount,
        benign: benignCount,
      },
    }
  },

  // ── Assistant Copilot Chat (Streaming POST /chat) ───────────────────────────
  async askAssistant(
    prompt: string,
    onChunk?: (text: string) => void,
    explicitSessionId?: string
  ): Promise<string> {
    // Persist sessionId in localStorage
    const storageKey = 'tidewatch_chat_session_id'
    let sessionId = explicitSessionId || localStorage.getItem(storageKey)
    if (!sessionId) {
      sessionId = `tw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      localStorage.setItem(storageKey, sessionId)
    }

    if (!USE_MOCKS) {
      try {
        const res = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt, sessionId }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          handleApiError(errData, `Chat request failed: ${res.statusText}`)
          throw new Error(errData?.error?.message || `HTTP ${res.status}`)
        }

        if (res.body) {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let accumulated = ''
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed.startsWith(':')) continue // comment / heartbeat
              if (trimmed.startsWith('data:')) {
                const dataStr = trimmed.slice(5).trim()
                if (dataStr === '[DONE]') break
                try {
                  const parsed = JSON.parse(dataStr)
                  if (parsed.token) {
                    accumulated += parsed.token
                    if (onChunk) onChunk(accumulated)
                  }
                } catch {
                  // Text token fallback
                  if (dataStr) {
                    accumulated += dataStr
                    if (onChunk) onChunk(accumulated)
                  }
                }
              }
            }
          }

          if (accumulated.trim().length > 0) {
            return accumulated
          }
        }
      } catch (e) {
        console.warn('Real chat stream unavailable, using simulated copilot:', e)
      }
    }

    // Local Mock Copilot
    const q = prompt.toLowerCase()
    let fullResponse = ''

    if (q.includes('why') || q.includes('flagged') || q.includes('portscan') || q.includes('loic')) {
      fullResponse = `### Root Cause Analysis & Tree Decision Path

The model identified this flow as malicious based on **3 primary non-linear feature interactions**:

1. **Abnormal Inter-Arrival Time (IAT Mean = 28.4 µs)**:
   Normal HTTP browser traffic exhibits human/network latency with mean IAT between **4,000 µs and 25,000 µs**. A mean of 28.4 µs indicates an automated packet generator loop firing at line-rate.

2. **Synthetic Initial TCP Window (29,200 bytes)**:
   Unlike default OS TCP stacks (Linux: 65,535; Windows: 64,240), this static window header matches the signature of the **LOIC / HOIC stress testing suite**.

3. **Packet Frequency Anomaly**:
   Throughput clocked at **34,430 pkts/sec** directed to port 80 without payload acknowledgment.

#### Recommended Mitigation
To block this traffic at the Linux host firewall:
\`\`\`bash
iptables -I INPUT -s 205.174.165.73 -p tcp --dport 80 -j DROP
\`\`\``
    } else if (q.includes('summarize') || q.includes('hour') || q.includes('trend')) {
      fullResponse = `### SecOps Hourly Summary Report

Over the past 60 minutes:
- **Total Ingress Flows Analyzed**: 14,892 flows
- **Flagged Threats**: 42 anomalies (Attack rate: 0.28%)
- **Dominant Attack Vector**: **DDoS-LOIC** (68% of flagged flows) targeting ingress proxy \`192.168.10.50:80\`
- **Secondary Vector**: **SYN Port Scans** originating from internal subnet \`192.168.10.51\` probing SMB and RPC services.

**Operational Action Items:**
1. \`205.174.165.73\` remains the highest velocity adversary with over 1,420 dropped packets.
2. Recommend immediate host isolation for workstation \`192.168.10.51\` for malware triage.`
    } else {
      fullResponse = `### Tidewatch ML Inference Engine Insights

Tidewatch continuously inspects 78 network flow telemetry features computed across microsecond windows without inspecting encrypted packet payload contents.

**Key capabilities you can query:**
- *"Why was flow #89421 flagged?"* — explains SHAP feature attributions and tree splits.
- *"Summarize the last hour"* — generates an executive SecOps threat assessment.
- *"Generate iptables rule for 205.174.165.73"* — creates copy-pasteable firewall commands.`
    }

    if (onChunk) {
      const words = fullResponse.split(' ')
      let current = ''
      for (const word of words) {
        current += (current ? ' ' : '') + word
        onChunk(current)
        await new Promise((r) => setTimeout(r, 14))
      }
    }

    return fullResponse
  },
}
