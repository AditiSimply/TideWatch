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
import Papa from 'papaparse'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export const api = {
  // KPI summary
  async getKpis(): Promise<KpiSummary> {
    if (API_BASE_URL) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/kpis`)
        if (res.ok) return await res.json()
      } catch (e) {
        console.warn('Backend unavailable, using simulation Kpis:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 80))
    return simulationEngine.getKpis()
  },

  // Traffic time series
  async getTrafficTimeSeries(_range: string = '1h'): Promise<TrafficDataPoint[]> {
    if (API_BASE_URL) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/traffic/series?range=${_range}`)
        if (res.ok) return await res.json()
      } catch (e) {
        console.warn('Backend unavailable, using mock series:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 60))
    return TRAFFIC_TIME_SERIES
  },

  // Attack class distribution for donut chart
  async getAttackDistribution(): Promise<AttackDistribution[]> {
    if (API_BASE_URL) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/attacks/distribution`)
        if (res.ok) return await res.json()
      } catch (e) {
        console.warn('Backend unavailable, using mock distribution:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 50))
    return ATTACK_DISTRIBUTION
  },

  // Top malicious source IPs
  async getTopIps(): Promise<TopIpMetric[]> {
    if (API_BASE_URL) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/traffic/top-ips`)
        if (res.ok) return await res.json()
      } catch (e) {
        console.warn('Backend unavailable, using mock top IPs:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 50))
    return TOP_MALICIOUS_IPS
  },

  // Flows list
  async getFlows(params?: {
    limit?: number
    offset?: number
    classFilter?: string
  }): Promise<{ flows: Flow[]; total: number }> {
    if (API_BASE_URL) {
      try {
        const query = new URLSearchParams()
        if (params?.limit) query.set('limit', String(params.limit))
        if (params?.offset) query.set('offset', String(params.offset))
        if (params?.classFilter) query.set('class', params.classFilter)
        const res = await fetch(`${API_BASE_URL}/api/flows?${query.toString()}`)
        if (res.ok) return await res.json()
      } catch (e) {
        console.warn('Backend unavailable, using simulation flows:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 90))
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

  // Alerts list
  async getAlerts(params?: {
    status?: string
    severity?: string
    search?: string
  }): Promise<Alert[]> {
    if (API_BASE_URL) {
      try {
        const query = new URLSearchParams()
        if (params?.status) query.set('status', params.status)
        if (params?.severity) query.set('severity', params.severity)
        const res = await fetch(`${API_BASE_URL}/api/alerts?${query.toString()}`)
        if (res.ok) return await res.json()
      } catch (e) {
        console.warn('Backend unavailable, using simulation alerts:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 80))
    let alerts = simulationEngine.getLatestAlerts()
    if (params?.status && params.status !== 'all') {
      alerts = alerts.filter((a) => a.status === params.status)
    }
    if (params?.severity && params.severity !== 'all') {
      alerts = alerts.filter((a) => a.severity === params.severity)
    }
    if (params?.search) {
      const q = params.search.toLowerCase()
      alerts = alerts.filter(
        (a) =>
          a.srcIp.toLowerCase().includes(q) ||
          a.dstIp.toLowerCase().includes(q) ||
          a.attackType.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q)
      )
    }
    return alerts
  },

  // Get specific alert with full AI report
  async getAlertById(id: string): Promise<Alert | null> {
    if (API_BASE_URL) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/alerts/${id}`)
        if (res.ok) return await res.json()
      } catch (e) {
        console.warn('Backend unavailable, using local alert lookup:', e)
      }
    }
    const alerts = simulationEngine.getLatestAlerts()
    const alert = alerts.find((a) => a.id === id) || null
    if (alert && !alert.aiReport) {
      alert.aiReport =
        INITIAL_AI_REPORTS[id] || {
          generatedAt: new Date().toISOString(),
          modelName: 'Tidewatch Ensemble v2.4 (XGBoost + CatBoost)',
          attackTaxonomy: `MITRE ATT&CK: ${alert.attackType}`,
          rootCauseAnalysis: `Automated detection flagged flow ${alert.flowId} due to anomalous inter-packet timings and extreme packet frequency diverging by >4.8 standard deviations from baseline profiles.`,
          keyFeatures: [
            {
              feature: 'Flow Packets/s',
              value: `${alert.flow.flowPacketsPerSec.toLocaleString()} pkts/s`,
              benchmark: '120-400 pkts/s',
              contribution: '+34.2%',
            },
            {
              feature: 'Flow IAT Mean',
              value: `${alert.flow.flowIATMean.toFixed(1)} µs`,
              benchmark: '8,400 µs',
              contribution: '+28.5%',
            },
            {
              feature: 'Init Win Bytes Fwd',
              value: `${alert.flow.initWinBytesForward} bytes`,
              benchmark: '65,535 bytes',
              contribution: '+14.1%',
            },
          ],
          impactAssessment:
            'Immediate risk of service degradation on destination service port. Potential resource exhaustion across TCP connection backlog tables.',
          recommendedMitigation: [
            {
              step: `Drop traffic from ${alert.srcIp} on incoming edge firewall.`,
              iptablesRule: `iptables -I INPUT -s ${alert.srcIp} -p ${alert.protocol.toLowerCase()} --dport ${alert.dstPort} -j DROP`,
              snortRule: `alert ${alert.protocol.toLowerCase()} ${alert.srcIp} any -> $HOME_NET ${alert.dstPort} (msg:"TIDEWATCH - Block ${alert.attackType}"; sid:9003001; rev:1;)`,
              priority: 'immediate',
            },
          ],
        }
    }
    return alert
  },

  // Update alert status
  async updateAlertStatus(id: string, status: AlertStatus): Promise<boolean> {
    if (API_BASE_URL) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/alerts/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        if (res.ok) return true
      } catch (e) {
        console.warn('Backend unavailable, updating local simulation:', e)
      }
    }
    simulationEngine.updateAlertStatus(id, status)
    return true
  },

  // Model evaluation metrics
  async getModelMetrics(): Promise<ModelMetrics> {
    if (API_BASE_URL) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/model/metrics`)
        if (res.ok) return await res.json()
      } catch (e) {
        console.warn('Backend unavailable, using mock model metrics:', e)
      }
    }
    await new Promise((r) => setTimeout(r, 60))
    return MODEL_METRICS
  },

  // CSV Analysis (CICIDS2017 Format)
  async analyzeCsv(
    csvContent: string
  ): Promise<{ results: PredictionResult[]; summary: { total: number; attacks: number; benign: number } }> {
    if (API_BASE_URL) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/analyze/csv`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/csv' },
          body: csvContent,
        })
        if (res.ok) return await res.json()
      } catch (e) {
        console.warn('Backend unavailable, analyzing CSV locally:', e)
      }
    }

    // Local client-side parse & inference simulation for CICIDS2017 headers
    await new Promise((r) => setTimeout(r, 400))
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

      // Heuristic model inference aligned with CICIDS2017 characteristics
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
        flaggedReason: isAnomaly
          ? `Predicted ${prediction} with ${(confidence * 100).toFixed(1)}% certainty`
          : undefined,
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

  // Assistant Chat response
  async askAssistant(
    prompt: string,
    onChunk?: (text: string) => void
  ): Promise<string> {
    const q = prompt.toLowerCase()
    let fullResponse = ''

    if (q.includes('why') || q.includes('flagged') || q.includes('portscan') || q.includes('loic')) {
      fullResponse = `### Root Cause Analysis & Tree Decision Path

The model identified this flow as malicious based on **3 primary non-linear feature interactions**:

1. **Abnormal Inter-Arrival Time (IAT Mean = 28.4 µs)**:
   Normal HTTP browser traffic exhibits human/network latency with mean IAT between **4,000 µs and 25,000 µs**. A mean of 28.4 µs indicates automated packet generator loop firing at line-rate.

2. **Synthetic Initial TCP Window (29,200 bytes)**:
   Unlike default OS TCP stacks (Linux: 65,535; Windows: 64,240), this static window header matches the hardcoded signature of the **LOIC / HOIC stress testing suite**.

3. **Packet Frequency Anomaly**:
   Throughput clocked at **34,430 pkts/sec** directed to port 80 without payload acknowledgment.

#### Recommended Mitigation
To block this traffic at the Linux host firewall:
\`\`\`bash
iptables -I INPUT -s 205.174.165.73 -p tcp --dport 80 -j DROP
\`\`\`
Or apply rate-limiting:
\`\`\`bash
iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
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
2. Recommend immediate host isolation for workstation \`192.168.10.51\` for malware triage.
3. Model confidence across all 42 alerts averaged **98.7%**, with zero borderline confidence (<90%) classifications.`
    } else if (q.includes('iptables') || q.includes('rule') || q.includes('block')) {
      fullResponse = `### Firewall Enforcement Rules (IPTables & Snort)

Here are the ready-to-deploy mitigation rules tailored to recent telemetry:

#### 1. Instant Host Drop (IPTables)
\`\`\`bash
# Drop offending Canadian proxy source
sudo iptables -I INPUT -s 205.174.165.73 -j DROP

# Drop internal reconnaissance host
sudo iptables -I INPUT -s 192.168.10.51 -p tcp --match multiport --dports 21,22,23,445,3389 -j DROP
\`\`\`

#### 2. Snort / Suricata IDS Signature
\`\`\`snort
alert tcp 205.174.165.73 any -> $HOME_NET 80 (msg:"TIDEWATCH - LOIC High Frequency Flooding Detected"; flow:to_server; threshold:type threshold, track by_src, count 200, seconds 2; sid:9001001; rev:1;)
\`\`\`

These rules will neutralize the ongoing anomalous traffic without disrupting normal user connections.`
    } else {
      fullResponse = `### Tidewatch ML Inference Engine Insights

Tidewatch continuously inspects 78 network flow telemetry features computed across microsecond windows without inspecting encrypted packet payload contents.

**Key capabilities you can query:**
- *"Why was flow #89421 flagged?"* — explains SHAP feature attributions and tree splits.
- *"Summarize the last hour"* — generates an executive SecOps threat assessment.
- *"Generate iptables rule for 205.174.165.73"* — creates copy-pasteable firewall commands.
- *"Compare LOIC vs GoldenEye"* — reviews protocol-level behavioral differences.`
    }

    // Simulate streaming tokens if callback provided
    if (onChunk) {
      const words = fullResponse.split(' ')
      let current = ''
      for (const word of words) {
        current += (current ? ' ' : '') + word
        onChunk(current)
        await new Promise((r) => setTimeout(r, 18))
      }
    }

    return fullResponse
  },
}
