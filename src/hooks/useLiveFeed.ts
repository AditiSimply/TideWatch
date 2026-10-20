import { useTrafficStream } from './useTrafficStream'

interface UseLiveFeedOptions {
  wsUrl?: string
  sseUrl?: string
  maxItems?: number
}

/**
 * useLiveFeed delegates directly to useTrafficStream, maintaining full backward compatibility.
 */
export function useLiveFeed(options: UseLiveFeedOptions = {}) {
  const stream = useTrafficStream({
    maxItems: options.maxItems,
  })

  return {
    flows: stream.flows,
    alerts: stream.alerts,
    kpis: stream.kpis,
    stats: stream.stats,
    isConnected: stream.isConnected,
    connectionType: stream.connectionType,
    lastEventTime: stream.lastEventTime,
    isRunning: stream.isRunning,
    toggleRunning: stream.toggleRunning,
    triggerAttackBurst: stream.triggerAttackBurst,
  }
}

export { useTrafficStream }
