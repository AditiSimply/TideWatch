import type { components } from './api'

// ── Re-export OpenAPI component schemas ──────────────────────────────────────
export type ApiComponents = components['schemas']
export type FlowResponse = components['schemas']['FlowResponse']
export type AlertResponse = components['schemas']['AlertResponse']
export type TriageReportResponse = components['schemas']['TriageReportResponse']
export type ModelMetricsResponse = components['schemas']['ModelMetricsResponse']
export type StatsOverviewResponse = components['schemas']['StatsOverviewResponse']
export type TimeseriesPoint = components['schemas']['TimeseriesPoint']
export type TopSourceMetric = components['schemas']['TopSourceMetric']
export type AttackDistItem = components['schemas']['AttackDistItem']
export type LLMStatusResponse = components['schemas']['LLMStatusResponse']
export type BatchPredictResponse = components['schemas']['BatchPredictResponse']
export type BatchPredictRow = components['schemas']['BatchPredictRow']
export type ChatMessageResponse = components['schemas']['ChatMessageResponse']
export type HTTPValidationError = components['schemas']['HTTPValidationError']

// ── Domain Types ─────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'benign'

export type AttackClass =
  | 'BENIGN'
  | 'DDoS-LOIC'
  | 'DoS-GoldenEye'
  | 'DoS-Slowloris'
  | 'PortScan'
  | 'Botnet'
  | 'Infiltration'
  | 'Web Attack - Brute Force'
  | 'Web Attack - XSS'
  | 'Web Attack - SQL Injection'
  | string

export type AlertStatus = 'open' | 'investigating' | 'resolved'

/**
 * Flow interface backed by OpenAPI FlowResponse, with UI telemetry extensions.
 */
export interface Flow {
  id: string
  timestamp: string // mapped from ts
  ts?: string
  srcIp: string
  srcPort: number
  dstIp: string
  dstPort: number
  protocol: 'TCP' | 'UDP' | 'ICMP' | string
  flowDuration?: number // microseconds
  totalFwdPackets?: number
  totalBwdPackets?: number
  totalLengthFwdPackets?: number
  totalLengthBwdPackets?: number
  flowBytesPerSec?: number
  flowPacketsPerSec?: number
  flowIATMean?: number
  synFlagCount?: number
  rstFlagCount?: number
  ackFlagCount?: number
  initWinBytesForward?: number
  prediction: AttackClass
  confidence: number // 0 to 1
  severity?: Severity
  flaggedReason?: string
  features?: { [key: string]: unknown } | null
}

/**
 * Alert interface backed by OpenAPI AlertResponse, with embedded Flow and AI report.
 */
export interface Alert {
  id: string
  flowId: string
  timestamp: string // mapped from createdAt
  createdAt?: string
  attackType: AttackClass
  severity: Severity
  srcIp: string
  srcPort: number
  dstIp: string
  dstPort: number
  protocol: 'TCP' | 'UDP' | 'ICMP' | string
  confidence: number
  status: AlertStatus
  summary: string
  flow: Flow
  aiReport?: AiReport
  provider?: string | null
  model?: string | null
}

/**
 * AiReport interface backed by OpenAPI TriageReportResponse.
 */
export interface AiReport {
  id?: string
  alertId?: string
  generatedAt: string
  modelName: string
  attackTaxonomy: string
  rootCauseAnalysis: string
  salientFeatures?: components['schemas']['SalientFeature'][]
  keyFeatures?: {
    feature: string
    value: string
    benchmark: string
    contribution: string
  }[]
  impactAssessment: string
  recommendedMitigation?: {
    step: string
    iptablesRule?: string
    snortRule?: string
    priority: 'immediate' | 'post-incident'
  }[]
  mitigations?: components['schemas']['MitigationStep'][]
  severityScore?: number
  provider?: string | null
  model?: string | null
}

export interface PredictionResult {
  rowId: number
  flow: Flow
  prediction: AttackClass
  confidence: number
  severity: Severity
  isAnomaly: boolean
}

export interface TrafficDataPoint {
  timestamp: string
  timeLabel: string
  benignFlows: number
  attackFlows: number
  totalBandwidthMb: number
}

export interface AttackDistribution {
  name: string
  count: number
  percentage: number
  color: string
}

export interface TopIpMetric {
  ip: string
  country: string
  flowsCount: number
  threatScore: number
  primaryAttack: AttackClass
  lastSeen: string
}

export interface ClassPerformance {
  className: AttackClass
  precision: number
  recall: number
  f1Score: number
  support: number
  rocAuc?: number | null
}

export interface ConfusionMatrixData {
  labels: AttackClass[] | string[]
  matrix: number[][] // row = true class, col = predicted class
}

export interface FeatureImportance {
  feature: string
  displayName?: string
  importance: number // 0 to 1
  shapImpact?: 'high_fwd' | 'high_iat' | 'high_rate' | 'protocol_flag'
  description?: string
}

/**
 * ModelMetrics backed by OpenAPI ModelMetricsResponse.
 */
export interface ModelMetrics {
  modelName: string
  version: string
  trainedOn: string
  lastUpdated?: string
  overallAccuracy?: number
  accuracy?: number
  macroF1: number
  weightedF1: number
  averageInferenceTimeMs?: number
  avgInferenceTimeMs?: number
  falsePositiveRate: number
  classes?: ClassPerformance[]
  perClass?: components['schemas']['ClassMetric'][]
  features?: FeatureImportance[]
  featureImportance?: components['schemas']['FeatureImportanceItem'][]
  confusionMatrix: ConfusionMatrixData
}

export interface KpiSummary {
  totalFlows: number
  attacksDetected: number
  attackRate: number
  avgConfidence: number
  activeThreatCount: number
  flowsLastMinute: number
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  timestamp: string
  content: string
  isStreaming?: boolean
  relatedFlowId?: string
}
