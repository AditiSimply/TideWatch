import { useEffect, useState, useCallback, useRef } from 'react'
import type { Flow, Alert, KpiSummary, AttackClass, Severity } from '@/types'
import { API_BASE_URL, USE_MOCKS, api } from '@/lib/api'
import { simulationEngine } from '@/lib/simulation'
import { getSeverityForAttack } from '@/lib/utils'

interface UseTrafficStreamOptions {
  speed?: number
  attackRatio?: number
  maxItems?: number
}

export interface StreamStats {
  flowsEmitted: number
  attacksEmitted: number
  attackRate: number
}

export function useTrafficStream(options: UseTrafficStreamOptions = {}) {
  const [flows, setFlows] = useState<Flow[]>(() => simulationEngine.getLatestFlows())
  const [alerts, setAlerts] = useState<Alert[]>(() => simulationEngine.getLatestAlerts())
  const [kpis, setKpis] = useState<KpiSummary>(() => simulationEngine.getKpis())
  const [stats, setStats] = useState<StreamStats | null>(null)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [connectionType, setConnectionType] = useState<'sse' | 'simulation'>('simulation')
  const [isRunning, setIsRunning] = useState<boolean>(true)
  const [lastEventTime, setLastEventTime] = useState<Date>(new Date())

  const maxItems = options.maxItems || 50
  const speed = options.speed || 1.0
  const attackRatio = options.attackRatio ?? 0.3

  const esRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const backoffDelayRef = useRef<number>(1000)
  const isMountedRef = useRef<boolean>(true)

  const handleFlow = useCallback((data: any) => {
    const attackType = (data.prediction || 'BENIGN') as AttackClass
    const severity = getSeverityForAttack(attackType)
    const newFlow: Flow = {
      id: String(data.id),
      timestamp: data.timestamp || new Date().toISOString(),
      srcIp: data.srcIp || '192.168.10.50',
      srcPort: Number(data.srcPort ?? 49152),
      dstIp: data.dstIp || '192.168.10.1',
      dstPort: Number(data.dstPort ?? 80),
      protocol: data.protocol || 'TCP',
      prediction: attackType,
      confidence: Number(data.confidence ?? 0.98),
      severity,
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

    setFlows((prev) => [newFlow, ...prev.slice(0, maxItems - 1)])
    setLastEventTime(new Date())

    // Increment flows in KPI
    setKpis((prev) => ({
      ...prev,
      totalFlows: prev.totalFlows + 1,
      flowsLastMinute: prev.flowsLastMinute + 1,
    }))
  }, [maxItems])

  const handleAlert = useCallback((data: any) => {
    const attackType = (data.attackType || 'DDoS') as AttackClass
    const severity = (data.severity || getSeverityForAttack(attackType)) as Severity
    const newAlert: Alert = {
      id: String(data.id),
      flowId: String(data.flowId || data.id),
      timestamp: data.createdAt || new Date().toISOString(),
      attackType,
      severity,
      srcIp: data.srcIp || '192.168.10.50',
      srcPort: 54128,
      dstIp: '192.168.10.1',
      dstPort: Number(data.dstPort ?? 80),
      protocol: 'TCP',
      confidence: Number(data.confidence ?? 0.98),
      status: (data.status || 'open') as any,
      summary: `${attackType} detected on port ${data.dstPort || 80}`,
      flow: {
        id: String(data.flowId || data.id),
        timestamp: data.createdAt || new Date().toISOString(),
        srcIp: data.srcIp || '192.168.10.50',
        srcPort: 54128,
        dstIp: '192.168.10.1',
        dstPort: Number(data.dstPort ?? 80),
        protocol: 'TCP',
        prediction: attackType,
        confidence: Number(data.confidence ?? 0.98),
        severity,
      },
    }

    setAlerts((prev) => [newAlert, ...prev.slice(0, maxItems - 1)])
    setLastEventTime(new Date())

    setKpis((prev) => ({
      ...prev,
      attacksDetected: prev.attacksDetected + 1,
      activeThreatCount: prev.activeThreatCount + 1,
      attackRate: (prev.attacksDetected + 1) / Math.max(1, prev.totalFlows),
    }))
  }, [maxItems])

  const handleStats = useCallback((data: any) => {
    setStats({
      flowsEmitted: data.flowsEmitted,
      attacksEmitted: data.attacksEmitted,
      attackRate: data.attackRate,
    })
  }, [])

  const connectSSE = useCallback(() => {
    if (USE_MOCKS) return

    const sseUrl = `${API_BASE_URL}/stream/traffic?speed=${speed}&attackRatio=${attackRatio}`
    try {
      if (esRef.current) {
        esRef.current.close()
      }

      const es = new EventSource(sseUrl)
      esRef.current = es

      es.onopen = () => {
        if (!isMountedRef.current) return
        setIsConnected(true)
        setConnectionType('sse')
        backoffDelayRef.current = 1000 // reset backoff
      }

      es.addEventListener('flow', (e: MessageEvent) => {
        if (!isMountedRef.current) return
        try {
          handleFlow(JSON.parse(e.data))
        } catch (err) {
          console.error('SSE Flow error', err)
        }
      })

      es.addEventListener('alert', (e: MessageEvent) => {
        if (!isMountedRef.current) return
        try {
          handleAlert(JSON.parse(e.data))
        } catch (err) {
          console.error('SSE Alert error', err)
        }
      })

      es.addEventListener('stats', (e: MessageEvent) => {
        if (!isMountedRef.current) return
        try {
          handleStats(JSON.parse(e.data))
        } catch (err) {
          console.error('SSE Stats error', err)
        }
      })

      es.onerror = () => {
        if (!isMountedRef.current) return
        es.close()
        setIsConnected(false)

        // Exponential backoff reconnect
        const delay = backoffDelayRef.current
        backoffDelayRef.current = Math.min(delay * 1.8, 30000)

        if (reconnectTimeoutRef.current) {
          window.clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (isMountedRef.current) {
            connectSSE()
          }
        }, delay)
      }
    } catch (e) {
      console.warn('Failed to initiate EventSource, will retry:', e)
    }
  }, [speed, attackRatio, handleFlow, handleAlert, handleStats])

  useEffect(() => {
    isMountedRef.current = true

    if (!USE_MOCKS) {
      connectSSE()
    } else {
      setConnectionType('simulation')
      setIsConnected(true)
    }

    // Always subscribe to simulationEngine as well for local updates or simulation mode
    const unsub = simulationEngine.subscribe((event) => {
      if (connectionType === 'simulation' || USE_MOCKS) {
        if (event.type === 'flow') handleFlow(event.data)
        else if (event.type === 'alert' || event.type === 'attack_burst') handleAlert(event.data)
        else if (event.type === 'kpi') setKpis(event.data as KpiSummary)
      }
    })

    return () => {
      isMountedRef.current = false
      if (esRef.current) {
        esRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current)
      }
      unsub()
    }
  }, [connectSSE, connectionType, handleFlow, handleAlert])

  const toggleRunning = async () => {
    const next = !isRunning
    setIsRunning(next)
    try {
      await api.controlStream(next ? 'start' : 'stop')
    } catch (e) {
      console.warn('Control stream API error:', e)
    }
    if (next) {
      simulationEngine.start()
    } else {
      simulationEngine.stop()
    }
  }

  const triggerAttackBurst = () => {
    simulationEngine.triggerAttackBurst()
  }

  return {
    flows,
    alerts,
    kpis,
    stats,
    isConnected,
    connectionType,
    lastEventTime,
    isRunning,
    toggleRunning,
    triggerAttackBurst,
  }
}
