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

export type AlertStatus = 'open' | 'investigating' | 'resolved'

export interface Flow {
  id: string
  timestamp: string
  srcIp: string
  srcPort: number
  dstIp: string
  dstPort: number
  protocol: 'TCP' | 'UDP' | 'ICMP'
  flowDuration: number // microseconds
  totalFwdPackets: number
  totalBwdPackets: number
  totalLengthFwdPackets: number
  totalLengthBwdPackets: number
  flowBytesPerSec: number
  flowPacketsPerSec: number
  flowIATMean: number
  synFlagCount: number
  rstFlagCount: number
  ackFlagCount: number
  initWinBytesForward: number
  prediction: AttackClass
  confidence: number // 0 to 1
  severity: Severity
  flaggedReason?: string
}

export interface Alert {
  id: string
  flowId: string
  timestamp: string
  attackType: AttackClass
  severity: Severity
  srcIp: string
  srcPort: number
  dstIp: string
  dstPort: number
  protocol: 'TCP' | 'UDP' | 'ICMP'
  confidence: number
  status: AlertStatus
  summary: string
  flow: Flow
  aiReport?: AiReport
}

export interface AiReport {
  generatedAt: string
  modelName: string
  attackTaxonomy: string
  rootCauseAnalysis: string
  keyFeatures: {
    feature: string
    value: string
    benchmark: string
    contribution: string
  }[]
  impactAssessment: string
  recommendedMitigation: {
    step: string
    iptablesRule?: string
    snortRule?: string
    priority: 'immediate' | 'post-incident'
  }[]
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
  rocAuc: number
}

export interface ConfusionMatrixData {
  labels: AttackClass[]
  matrix: number[][] // row = true class, col = predicted class
}

export interface FeatureImportance {
  feature: string
  displayName: string
  importance: number // 0 to 1
  shapImpact: 'high_fwd' | 'high_iat' | 'high_rate' | 'protocol_flag'
  description: string
}

export interface ModelMetrics {
  modelName: string
  version: string
  trainedOn: string
  lastUpdated: string
  overallAccuracy: number
  macroF1: number
  weightedF1: number
  averageInferenceTimeMs: number
  falsePositiveRate: number
  classes: ClassPerformance[]
  features: FeatureImportance[]
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
