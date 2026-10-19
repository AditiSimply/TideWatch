import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Alert, AlertStatus } from '@/types'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { AlertDrawer } from '@/components/alerts/AlertDrawer'
import { TableSkeleton } from '@/components/common/Skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { timeAgo } from '@/lib/utils'
import {
  Search,
  Clock,
  ChevronRight,
} from 'lucide-react'

export const AlertsPage: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // TanStack Query for fetching alerts
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['alerts', selectedStatus, selectedSeverity, searchQuery],
    queryFn: () =>
      api.getAlerts({
        status: selectedStatus,
        severity: selectedSeverity,
        search: searchQuery,
      }),
    refetchInterval: 5000,
  })

  const handleOpenDrawer = async (alert: Alert) => {
    const fullAlert = await api.getAlertById(alert.id)
    setActiveAlert(fullAlert || alert)
    setIsDrawerOpen(true)
  }

  const handleUpdateStatus = async (alertId: string, status: AlertStatus) => {
    await api.updateAlertStatus(alertId, status)
    if (activeAlert && activeAlert.id === alertId) {
      setActiveAlert({ ...activeAlert, status })
    }
    refetch()
  }

  // Calculate status counts
  const openCount = alerts.filter((a) => a.status === 'open').length
  const investigatingCount = alerts.filter((a) => a.status === 'investigating').length
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length

  return (
    <div className="space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E2EBE5] pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F3D2E] tracking-tight">
            Security Incident Log
          </h1>
          <p className="text-sm text-[#526D61] mt-1">
            Real-time feed of anomalous flows flagged by tree ensemble decision thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-white border border-[#D5E3DC] text-[#405B50] font-mono shadow-2xs">
            {openCount} Open • {investigatingCount} Active
          </span>
        </div>
      </div>

      {/* Filter and Tab Strip */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Tab buttons */}
        <div className="inline-flex rounded-xl border border-[#E2EBE5] bg-white p-1 text-xs self-start shadow-2xs">
          {[
            { id: 'all', label: 'All Incidents', count: alerts.length },
            { id: 'open', label: 'Open', count: openCount },
            { id: 'investigating', label: 'Investigating', count: investigatingCount },
            { id: 'resolved', label: 'Resolved', count: resolvedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                selectedStatus === tab.id
                  ? 'bg-[#0F3D2E] text-white shadow-xs font-semibold'
                  : 'text-[#526D61] hover:text-[#0F3D2E]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedStatus === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EBF4F0] text-[#0F3D2E]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Severity & Search filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#637D72] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by IP, port, or attack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E2EBE5] bg-white text-xs text-[#0F3D2E] placeholder-[#637D72] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
            />
          </div>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E2EBE5] bg-white text-xs text-[#0F3D2E] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts Table View */}
      <div className="editorial-card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : alerts.length === 0 ? (
          <EmptyState
            title="No Incidents Found"
            description="No network flows match your current filter parameters or the telemetry stream is currently quiet."
            actionLabel="Reset Filters"
            onAction={() => {
              setSelectedStatus('all')
              setSelectedSeverity('all')
              setSearchQuery('')
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFBF8] border-b border-[#E2EBE5] text-[11px] text-[#526D61]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Incident / Time</th>
                  <th className="py-3 px-4 font-semibold">Classification</th>
                  <th className="py-3 px-4 font-semibold">Severity</th>
                  <th className="py-3 px-4 font-semibold">5-Tuple Origin</th>
                  <th className="py-3 px-4 font-semibold">Confidence</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF4F0]">
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => handleOpenDrawer(alert)}
                    className="hover:bg-[#F8FAF9] transition-colors cursor-pointer group"
                  >
                    {/* ID & Time */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-[#0F3D2E] font-medium">
                        {alert.id}
                      </div>
                      <span className="text-[10px] text-[#637D72] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {timeAgo(alert.timestamp)}
                      </span>
                    </td>

                    {/* Attack Classification */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#0F3D2E] block">
                        {alert.attackType}
                      </span>
                      <span className="text-[11px] text-[#637D72] truncate max-w-xs block mt-0.5">
                        {alert.summary}
                      </span>
                    </td>

                    {/* Severity Badge */}
                    <td className="py-3 px-4">
                      <SeverityBadge severity={alert.severity} />
                    </td>

                    {/* Endpoints */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-[#0F3D2E]">
                        {alert.srcIp} → {alert.dstIp}:{alert.dstPort}
                      </div>
                      <span className="text-[10px] font-mono text-[#637D72]">
                        {alert.protocol} • Flow: {alert.flowId}
                      </span>
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-[#E2EBE5] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#10B981] rounded-full"
                            style={{ width: `${alert.confidence * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-[#526D61]">
                          {(alert.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    {/* Status Pill */}
                    <td
                      className="py-3 px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={alert.status}
                        onChange={(e) =>
                          handleUpdateStatus(alert.id, e.target.value as AlertStatus)
                        }
                        className={`text-xs rounded-md px-2 py-1 border font-medium cursor-pointer focus:outline-none ${
                          alert.status === 'open'
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : alert.status === 'investigating'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDrawer(alert)
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F3D2E] hover:text-[#10B981] group-hover:translate-x-0.5 transition-all"
                      >
                        <span>Investigate</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 bg-[#FAFBF8] border-t border-[#E2EBE5] text-[11px] text-[#526D61] flex items-center justify-between">
          <span>Click any row to open the AI Root Cause & Mitigation Drawer</span>
          <span className="font-mono text-[#0F3D2E]">CICIDS2017 Heuristic Engine</span>
        </div>
      </div>

      {/* Side Drawer Component */}
      <AlertDrawer
        alert={activeAlert}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  )
}
