import React, { useState } from 'react'
import { useLiveFeed } from '@/hooks/useLiveFeed'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Alert, AlertStatus } from '@/types'
import { StatCard } from '@/components/common/StatCard'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { TrafficLineChart } from '@/components/charts/TrafficLineChart'
import { AttackTypeDonut } from '@/components/charts/AttackTypeDonut'
import { TopIpsBarChart } from '@/components/charts/TopIpsBarChart'
import { AlertDrawer } from '@/components/alerts/AlertDrawer'
import { timeAgo } from '@/lib/utils'
import {
  ChevronRight,
  Radio,
} from 'lucide-react'

export const DashboardPage: React.FC = () => {
  const { kpis, alerts: liveAlerts, connectionType } = useLiveFeed()
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  // TanStack Query for static baseline charts
  const { data: trafficSeries, isLoading: trafficLoading } = useQuery({
    queryKey: ['trafficSeries'],
    queryFn: () => api.getTrafficTimeSeries(),
    staleTime: 60000,
  })

  const { data: attackDist, isLoading: distLoading } = useQuery({
    queryKey: ['attackDistribution'],
    queryFn: () => api.getAttackDistribution(),
    staleTime: 60000,
  })

  const { data: topIps, isLoading: ipsLoading } = useQuery({
    queryKey: ['topIps'],
    queryFn: () => api.getTopIps(),
    staleTime: 60000,
  })

  const handleOpenAlert = async (alert: Alert) => {
    // Fetch full AI report if not already populated
    const fullAlert = await api.getAlertById(alert.id)
    setSelectedAlert(fullAlert || alert)
    setIsDrawerOpen(true)
  }

  const handleUpdateStatus = (alertId: string, status: AlertStatus) => {
    api.updateAlertStatus(alertId, status)
    if (selectedAlert && selectedAlert.id === alertId) {
      setSelectedAlert({ ...selectedAlert, status })
    }
  }

  const filteredAlerts = liveAlerts.filter((a) => {
    if (severityFilter === 'all') return true
    return a.severity === severityFilter
  })

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E2EBE5] pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F3D2E] tracking-tight">
            Security Operations Ingress
          </h1>
          <p className="text-sm text-[#526D61] mt-1">
            Real-time multi-dimensional flow analysis. Continuous telemetry from border interfaces.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#D5E3DC] text-[#405B50] shadow-2xs">
            <Radio className="w-3.5 h-3.5 text-[#10B981] animate-pulse" />
            <span className="font-medium">
              Feed: {connectionType === 'websocket' ? 'WebSocket' : connectionType === 'sse' ? 'SSE' : 'Simulated'}
            </span>
          </span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Flows Analyzed"
          value={kpis.totalFlows}
          subtext={`${kpis.flowsLastMinute.toLocaleString()} flows flagged in the last minute`}
          trend={{ value: '+4.2%', isPositive: true }}
          badge="Live"
        />
        <StatCard
          label="Attacks Detected"
          value={kpis.attacksDetected}
          subtext={`${kpis.activeThreatCount} active security incidents awaiting triage`}
          trend={{ value: 'Anomalous', isPositive: false }}
        />
        <StatCard
          label="Attack Flow Ratio"
          value={`${(kpis.attackRate * 100).toFixed(2)}%`}
          isNumeric={false}
          subtext="Calculated over trailing 15-minute sliding window"
          trend={{ value: 'Normal baseline < 1%', neutral: true }}
        />
        <StatCard
          label="Avg Model Confidence"
          value={`${(kpis.avgConfidence * 100).toFixed(1)}%`}
          isNumeric={false}
          subtext="Ensemble calibration score on positive classifications"
          trend={{ value: '99.8% F1', isPositive: true }}
        />
      </div>

      {/* Charts Row: Traffic Line + Attack Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <TrafficLineChart
            data={trafficSeries || []}
            isLoading={trafficLoading}
          />
        </div>
        <div className="lg:col-span-4">
          <AttackTypeDonut
            data={attackDist || []}
            isLoading={distLoading}
          />
        </div>
      </div>

      {/* Second Row: Top Adversary IPs + Live Alert Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top IPs */}
        <div className="lg:col-span-5">
          <TopIpsBarChart
            data={topIps || []}
            isLoading={ipsLoading}
            onSelectIp={(ip) => {
              // Quick jump to alerts with ip
              console.log('Selected IP:', ip)
            }}
          />
        </div>

        {/* Live Alert Feed */}
        <div className="lg:col-span-7 editorial-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold text-[#0F3D2E] tracking-tight">
                    Live Security Incident Feed
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#EBF4F0] text-[#0F3D2E] border border-[#D5E3DC]">
                    {filteredAlerts.length} events
                  </span>
                </div>
                <p className="text-xs text-[#637D72] mt-0.5">
                  Streaming anomalies classified by XGBoost flow heuristics
                </p>
              </div>

              {/* Severity filter pill */}
              <div className="inline-flex rounded-lg border border-[#E2EBE5] bg-[#FAFBF8] p-0.5 text-xs">
                {(['all', 'critical', 'high', 'medium'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2 py-0.5 capitalize rounded-md transition-colors ${
                      severityFilter === sev
                        ? 'bg-white text-[#0F3D2E] font-medium shadow-xs border border-[#D5E3DC]'
                        : 'text-[#637D72] hover:text-[#0F3D2E]'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Alerts Table / Stream List */}
            <div className="divide-y divide-[#EEF4F0] overflow-y-auto max-h-[360px] pr-1">
              {filteredAlerts.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#526D61]">
                  No active incidents matching the selected filter.
                </div>
              ) : (
                filteredAlerts.slice(0, 8).map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleOpenAlert(alert)}
                    className="py-3 px-2 rounded-lg hover:bg-[#F6FAF8] transition-colors cursor-pointer flex items-center justify-between gap-3 group animate-new-row"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SeverityBadge severity={alert.severity} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#0F3D2E] truncate">
                            {alert.attackType}
                          </span>
                          <span className="text-[11px] font-mono text-[#526D61]">
                            {alert.srcIp} → :{alert.dstPort}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#637D72] truncate max-w-sm mt-0.5">
                          {alert.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div className="text-[11px] text-[#526D61]">
                        <span className="font-mono block">{timeAgo(alert.timestamp)}</span>
                        <span className="text-[10px] uppercase font-semibold text-[#10B981]">
                          {(alert.confidence * 100).toFixed(0)}% conf
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A7C4B5] group-hover:text-[#0F3D2E] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#EEF4F0] flex items-center justify-between text-xs text-[#526D61]">
            <span>Click any incident to inspect root cause & generate firewall rules</span>
            <span className="font-medium text-[#0F3D2E]">
              {liveAlerts.length} total events in cache
            </span>
          </div>
        </div>
      </div>

      {/* Side Drawer for Alert Investigation */}
      <AlertDrawer
        alert={selectedAlert}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  )
}
