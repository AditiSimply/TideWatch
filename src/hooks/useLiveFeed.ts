import { useEffect, useState, useCallback, useRef } from 'react'
import type { Flow, Alert, KpiSummary } from '@/types'
import { simulationEngine } from '@/lib/simulation'

interface UseLiveFeedOptions {
  wsUrl?: string
  sseUrl?: string
  maxItems?: number
}

export function useLiveFeed(options: UseLiveFeedOptions = {}) {
  const [flows, setFlows] = useState<Flow[]>(() => simulationEngine.getLatestFlows())
  const [alerts, setAlerts] = useState<Alert[]>(() => simulationEngine.getLatestAlerts())
  const [kpis, setKpis] = useState<KpiSummary>(() => simulationEngine.getKpis())
  const [isConnected, setIsConnected] = useState<boolean>(true)
  const [connectionType, setConnectionType] = useState<'websocket' | 'sse' | 'simulation'>('simulation')
  const [lastEventTime, setLastEventTime] = useState<Date>(new Date())

  const maxItems = options.maxItems || 50
  const socketRef = useRef<WebSocket | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const handleNewFlow = useCallback((flow: Flow) => {
    setFlows((prev) => [flow, ...prev.slice(0, maxItems - 1)])
    setLastEventTime(new Date())
  }, [maxItems])

  const handleNewAlert = useCallback((alert: Alert) => {
    setAlerts((prev) => [alert, ...prev.slice(0, maxItems - 1)])
    setLastEventTime(new Date())
  }, [maxItems])

  const handleKpiUpdate = useCallback((newKpis: KpiSummary) => {
    setKpis(newKpis)
  }, [])

  useEffect(() => {
    const wsEndpoint = options.wsUrl || import.meta.env.VITE_WS_URL
    const sseEndpoint = options.sseUrl || import.meta.env.VITE_SSE_URL

    // 1. If WebSocket URL is configured, try native WebSocket
    if (wsEndpoint && typeof window !== 'undefined' && 'WebSocket' in window) {
      try {
        const ws = new WebSocket(wsEndpoint)
        socketRef.current = ws

        ws.onopen = () => {
          setIsConnected(true)
          setConnectionType('websocket')
        }

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data)
            if (parsed.type === 'flow') handleNewFlow(parsed.data)
            else if (parsed.type === 'alert') handleNewAlert(parsed.data)
            else if (parsed.type === 'kpi') handleKpiUpdate(parsed.data)
          } catch (e) {
            console.error('Failed to parse WebSocket message', e)
          }
        }

        ws.onerror = () => {
          setIsConnected(false)
        }

        ws.onclose = () => {
          setIsConnected(false)
          // Fall back to simulation engine
          setConnectionType('simulation')
        }

        return () => {
          ws.close()
        }
      } catch (e) {
        console.warn('Could not establish WebSocket, falling back to SSE or simulation', e)
      }
    }

    // 2. If SSE URL is configured and no active WS, try native EventSource
    if (sseEndpoint && typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        const es = new EventSource(sseEndpoint)
        eventSourceRef.current = es

        es.onopen = () => {
          setIsConnected(true)
          setConnectionType('sse')
        }

        es.addEventListener('flow', (e: MessageEvent) => {
          try {
            handleNewFlow(JSON.parse(e.data))
          } catch (err) {
            console.error('SSE Flow parse error', err)
          }
        })

        es.addEventListener('alert', (e: MessageEvent) => {
          try {
            handleNewAlert(JSON.parse(e.data))
          } catch (err) {
            console.error('SSE Alert parse error', err)
          }
        })

        es.addEventListener('kpi', (e: MessageEvent) => {
          try {
            handleKpiUpdate(JSON.parse(e.data))
          } catch (err) {
            console.error('SSE KPI parse error', err)
          }
        })

        es.onerror = () => {
          es.close()
          setIsConnected(false)
          setConnectionType('simulation')
        }

        return () => {
          es.close()
        }
      } catch (e) {
        console.warn('Could not establish EventSource, falling back to simulation', e)
      }
    }

    // 3. Fallback: native subscription to local simulation engine
    setConnectionType('simulation')
    setIsConnected(true)

    const unsubscribe = simulationEngine.subscribe((event) => {
      if (event.type === 'flow') {
        handleNewFlow(event.data as Flow)
      } else if (event.type === 'alert' || event.type === 'attack_burst') {
        handleNewAlert(event.data as Alert)
      } else if (event.type === 'kpi') {
        handleKpiUpdate(event.data as KpiSummary)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [options.wsUrl, options.sseUrl, handleNewFlow, handleNewAlert, handleKpiUpdate])

  return {
    flows,
    alerts,
    kpis,
    isConnected,
    connectionType,
    lastEventTime,
  }
}
