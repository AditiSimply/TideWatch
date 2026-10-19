import type { Flow, Alert, AttackClass, Severity, KpiSummary } from '@/types'
import { INITIAL_FLOWS, INITIAL_ALERTS, INITIAL_KPIS } from './mockData'
import { getSeverityForAttack } from './utils'

type SimulationListener = (event: {
  type: 'flow' | 'alert' | 'kpi' | 'attack_burst'
  data: Flow | Alert | KpiSummary
}) => void

class SimulationEngine {
  private isRunning: boolean = true
  private speedMultiplier: number = 1
  private timer: ReturnType<typeof setInterval> | null = null
  private listeners: Set<SimulationListener> = new Set()

  private flows: Flow[] = [...INITIAL_FLOWS]
  private alerts: Alert[] = [...INITIAL_ALERTS]
  private kpis: KpiSummary = { ...INITIAL_KPIS }

  private counter: number = 89430

  constructor() {
    this.start()
  }

  public subscribe(listener: SimulationListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(type: 'flow' | 'alert' | 'kpi' | 'attack_burst', data: Flow | Alert | KpiSummary) {
    for (const listener of this.listeners) {
      try {
        listener({ type, data })
      } catch (err) {
        console.error('Error in simulation listener:', err)
      }
    }
  }

  public start() {
    if (this.timer) clearInterval(this.timer)
    this.isRunning = true
    const interval = Math.max(250, Math.floor(1000 / this.speedMultiplier))
    this.timer = setInterval(() => {
      this.tick()
    }, interval)
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.isRunning = false
  }

  public toggle(): boolean {
    if (this.isRunning) {
      this.stop()
    } else {
      this.start()
    }
    return this.isRunning
  }

  public setSpeed(multiplier: number) {
    this.speedMultiplier = multiplier
    if (this.isRunning) {
      this.start()
    }
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      speedMultiplier: this.speedMultiplier,
    }
  }

  public getLatestFlows(): Flow[] {
    return [...this.flows]
  }

  public getLatestAlerts(): Alert[] {
    return [...this.alerts]
  }

  public getKpis(): KpiSummary {
    return { ...this.kpis }
  }

  public updateAlertStatus(alertId: string, status: 'open' | 'investigating' | 'resolved') {
    const alert = this.alerts.find((a) => a.id === alertId)
    if (alert) {
      alert.status = status
      this.notify('alert', alert)
    }
  }

  // Manually trigger an attack burst for live demonstration
  public triggerAttackBurst(customAttack?: AttackClass) {
    const attackType: AttackClass =
      customAttack || (Math.random() > 0.5 ? 'DDoS-LOIC' : 'PortScan')
    const ip = attackType === 'DDoS-LOIC' ? '205.174.165.73' : '192.168.10.188'
    const severity: Severity = getSeverityForAttack(attackType)

    this.counter++
    const newFlow: Flow = {
      id: `flw-${this.counter}`,
      timestamp: new Date().toISOString(),
      srcIp: ip,
      srcPort: 49000 + Math.floor(Math.random() * 10000),
      dstIp: '192.168.10.50',
      dstPort: 80,
      protocol: 'TCP',
      flowDuration: 18200,
      totalFwdPackets: 1200,
      totalBwdPackets: 8,
      totalLengthFwdPackets: 264000,
      totalLengthBwdPackets: 480,
      flowBytesPerSec: 14505494,
      flowPacketsPerSec: 66373,
      flowIATMean: 15.1,
      synFlagCount: 1,
      rstFlagCount: 0,
      ackFlagCount: 1,
      initWinBytesForward: 29200,
      prediction: attackType,
      confidence: 0.999,
      severity,
      flaggedReason: 'Simulated high-velocity burst: extreme packet density (>60k pkts/s)',
    }

    const newAlert: Alert = {
      id: `alt-${Date.now().toString(36)}`,
      flowId: newFlow.id,
      timestamp: newFlow.timestamp,
      attackType,
      severity,
      srcIp: newFlow.srcIp,
      srcPort: newFlow.srcPort,
      dstIp: newFlow.dstIp,
      dstPort: newFlow.dstPort,
      protocol: newFlow.protocol,
      confidence: newFlow.confidence,
      status: 'open',
      summary: `Critical anomaly injection: ${attackType} from ${ip}`,
      flow: newFlow,
    }

    this.flows.unshift(newFlow)
    if (this.flows.length > 200) this.flows.pop()

    this.alerts.unshift(newAlert)
    if (this.alerts.length > 50) this.alerts.pop()

    this.kpis.totalFlows += 1
    this.kpis.attacksDetected += 1
    this.kpis.attackRate = this.kpis.attacksDetected / this.kpis.totalFlows
    this.kpis.activeThreatCount += 1

    this.notify('flow', newFlow)
    this.notify('alert', newAlert)
    this.notify('kpi', this.kpis)
    this.notify('attack_burst', newAlert)
  }

  private tick() {
    this.counter++
    const isAttack = Math.random() < 0.14 // ~14% chance of attack flow during simulation

    let attackType: AttackClass = 'BENIGN'
    let severity: Severity = 'benign'
    let srcIp = `10.0.0.${Math.floor(Math.random() * 80) + 10}`
    let dstIp = '142.250.190.46'
    let dstPort = 443
    let fwdPkts = Math.floor(Math.random() * 40) + 5
    let bwdPkts = Math.floor(Math.random() * 50) + 5
    let bytesPerSec = Math.floor(Math.random() * 120000) + 20000
    let pktsPerSec = Math.floor(Math.random() * 400) + 50
    let iatMean = Math.floor(Math.random() * 15000) + 2000
    let confidence = 0.985 + Math.random() * 0.014
    let flaggedReason: string | undefined = undefined

    if (isAttack) {
      const attackPool: AttackClass[] = [
        'DDoS-LOIC',
        'PortScan',
        'DoS-GoldenEye',
        'Botnet',
        'DoS-Slowloris',
        'Web Attack - Brute Force',
      ]
      attackType = attackPool[Math.floor(Math.random() * attackPool.length)]
      severity = getSeverityForAttack(attackType)

      if (attackType === 'DDoS-LOIC') {
        srcIp = '205.174.165.73'
        dstIp = '192.168.10.50'
        dstPort = 80
        fwdPkts = 650 + Math.floor(Math.random() * 300)
        bwdPkts = 2
        pktsPerSec = 28000 + Math.floor(Math.random() * 12000)
        bytesPerSec = 6200000 + Math.floor(Math.random() * 2000000)
        iatMean = 22.0 + Math.random() * 10
        confidence = 0.997
        flaggedReason = 'Synthetic packet stream: anomalous IAT & high packet density'
      } else if (attackType === 'PortScan') {
        srcIp = '192.168.10.51'
        dstIp = '192.168.10.1'
        dstPort = Math.floor(Math.random() * 1024) + 1
        fwdPkts = 1
        bwdPkts = 1
        pktsPerSec = 8500
        bytesPerSec = 350000
        iatMean = 150
        confidence = 0.989
        flaggedReason = 'Rapid SYN sequence across contiguous ports'
      } else {
        srcIp = '198.51.100.22'
        dstIp = '192.168.10.50'
        dstPort = 8080
        confidence = 0.965
        flaggedReason = 'High anomalous flow signature matching trained tree split'
      }
    }

    const flow: Flow = {
      id: `flw-${this.counter}`,
      timestamp: new Date().toISOString(),
      srcIp,
      srcPort: 32000 + Math.floor(Math.random() * 28000),
      dstIp,
      dstPort,
      protocol: 'TCP',
      flowDuration: Math.floor(Math.random() * 250000) + 1000,
      totalFwdPackets: fwdPkts,
      totalBwdPackets: bwdPkts,
      totalLengthFwdPackets: fwdPkts * 450,
      totalLengthBwdPackets: bwdPkts * 900,
      flowBytesPerSec: bytesPerSec,
      flowPacketsPerSec: pktsPerSec,
      flowIATMean: iatMean,
      synFlagCount: 1,
      rstFlagCount: attackType === 'PortScan' ? 1 : 0,
      ackFlagCount: 1,
      initWinBytesForward: isAttack ? 29200 : 65535,
      prediction: attackType,
      confidence,
      severity,
      flaggedReason,
    }

    this.flows.unshift(flow)
    if (this.flows.length > 200) this.flows.pop()

    this.kpis.totalFlows += 1

    this.notify('flow', flow)

    if (isAttack) {
      const alert: Alert = {
        id: `alt-${Date.now().toString(36)}`,
        flowId: flow.id,
        timestamp: flow.timestamp,
        attackType,
        severity,
        srcIp: flow.srcIp,
        srcPort: flow.srcPort,
        dstIp: flow.dstIp,
        dstPort: flow.dstPort,
        protocol: flow.protocol,
        confidence: flow.confidence,
        status: 'open',
        summary: flow.flaggedReason || `ML detected anomalous ${attackType} telemetry`,
        flow,
      }
      this.alerts.unshift(alert)
      if (this.alerts.length > 50) this.alerts.pop()

      this.kpis.attacksDetected += 1
      this.kpis.activeThreatCount += 1
      this.kpis.attackRate = this.kpis.attacksDetected / this.kpis.totalFlows

      this.notify('alert', alert)
    }

    this.notify('kpi', this.kpis)
  }
}

export const simulationEngine = new SimulationEngine()
