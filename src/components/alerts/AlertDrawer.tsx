import React, { useState } from 'react'
import type { Alert, AlertStatus } from '@/types'
import { Drawer } from '@/components/common/Drawer'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { MarkdownView } from '@/components/common/MarkdownView'
import { formatDurationUs, formatBytes } from '@/lib/utils'
import {
  ShieldAlert,
  Clock,
  ArrowRight,
  Terminal,
  Activity,
  CheckCircle2,
} from 'lucide-react'

interface AlertDrawerProps {
  alert: Alert | null
  isOpen: boolean
  onClose: () => void
  onUpdateStatus?: (alertId: string, status: AlertStatus) => void
}

export const AlertDrawer: React.FC<AlertDrawerProps> = ({
  alert,
  isOpen,
  onClose,
  onUpdateStatus,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<AlertStatus>(alert?.status || 'open')

  if (!alert) return null

  const flow = alert.flow
  const aiReport = alert.aiReport

  const handleStatusChange = (newStatus: AlertStatus) => {
    setSelectedStatus(newStatus)
    if (onUpdateStatus) {
      onUpdateStatus(alert.id, newStatus)
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={alert.attackType}
      subtitle={`Alert ID: ${alert.id} • Flow: ${alert.flowId}`}
      maxWidthClass="max-w-2xl"
    >
      {/* Top Banner with Severity & Status Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#FAFBF8] border border-[#E2EBE5]">
        <div className="flex items-center gap-3">
          <SeverityBadge severity={alert.severity} />
          <span className="text-xs text-[#526D61] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {new Date(alert.timestamp).toLocaleTimeString()}
          </span>
          <span className="text-xs font-mono text-[#0F3D2E] bg-white px-2 py-0.5 rounded border border-[#D5E3DC]">
            Confidence: {(alert.confidence * 100).toFixed(1)}%
          </span>
        </div>

        {/* Status Switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#526D61] font-medium">Status:</span>
          <div className="inline-flex rounded-lg border border-[#D5E3DC] bg-white p-0.5 shadow-2xs">
            {(['open', 'investigating', 'resolved'] as AlertStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => handleStatusChange(st)}
                className={`px-2.5 py-1 text-xs capitalize font-medium rounded-md transition-colors ${
                  (selectedStatus || alert.status) === st
                    ? 'bg-[#0F3D2E] text-white shadow-xs'
                    : 'text-[#526D61] hover:text-[#0F3D2E]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Network Endpoint Card */}
      <div className="editorial-card p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#405B50] mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#10B981]" />
          Network 5-Tuple
        </h4>
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-[#FAFBF8] border border-[#E2EBE5]">
          <div>
            <span className="text-[10px] uppercase font-semibold text-[#637D72] block mb-0.5">
              Source Host
            </span>
            <span className="font-mono text-sm font-semibold text-[#0F3D2E]">
              {alert.srcIp}:{alert.srcPort}
            </span>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-[10px] font-mono text-[#526D61] font-medium">
              {alert.protocol}
            </span>
            <ArrowRight className="w-4 h-4 text-[#A7C4B5]" />
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-[#637D72] block mb-0.5">
              Target Service
            </span>
            <span className="font-mono text-sm font-semibold text-[#0F3D2E]">
              {alert.dstIp}:{alert.dstPort}
            </span>
          </div>
        </div>
      </div>

      {/* Flow Telemetry Metrics Grid */}
      <div className="editorial-card p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#405B50] mb-3">
          Extracted CICIDS2017 Flow Telemetry
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-[#FAFBF8] border border-[#E2EBE5]">
            <span className="text-[#637D72] text-[11px] block">Duration</span>
            <span className="font-mono font-medium text-[#0F3D2E] mt-0.5 block">
              {formatDurationUs(flow.flowDuration)}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FAFBF8] border border-[#E2EBE5]">
            <span className="text-[#637D72] text-[11px] block">Packets / Sec</span>
            <span className="font-mono font-medium text-[#0F3D2E] mt-0.5 block">
              {flow.flowPacketsPerSec.toLocaleString()}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FAFBF8] border border-[#E2EBE5]">
            <span className="text-[#637D72] text-[11px] block">Throughput</span>
            <span className="font-mono font-medium text-[#0F3D2E] mt-0.5 block">
              {formatBytes(flow.flowBytesPerSec)}/s
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FAFBF8] border border-[#E2EBE5]">
            <span className="text-[#637D72] text-[11px] block">IAT Mean</span>
            <span className="font-mono font-medium text-[#0F3D2E] mt-0.5 block">
              {flow.flowIATMean.toFixed(1)} µs
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FAFBF8] border border-[#E2EBE5]">
            <span className="text-[#637D72] text-[11px] block">Fwd / Bwd Packets</span>
            <span className="font-mono font-medium text-[#0F3D2E] mt-0.5 block">
              {flow.totalFwdPackets} / {flow.totalBwdPackets}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FAFBF8] border border-[#E2EBE5]">
            <span className="text-[#637D72] text-[11px] block">SYN / RST / ACK</span>
            <span className="font-mono font-medium text-[#0F3D2E] mt-0.5 block">
              {flow.synFlagCount} / {flow.rstFlagCount} / {flow.ackFlagCount}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FAFBF8] border border-[#E2EBE5] col-span-2">
            <span className="text-[#637D72] text-[11px] block">Init Window Bytes Fwd</span>
            <span className="font-mono font-medium text-[#0F3D2E] mt-0.5 block">
              {flow.initWinBytesForward.toLocaleString()} bytes
            </span>
          </div>
        </div>
      </div>

      {/* AI-Generated Explanation & Mitigation */}
      <div className="editorial-card p-5 border-l-4 border-l-[#10B981] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#10B981]" />
            <h4 className="font-display text-base font-semibold text-[#0F3D2E]">
              AI SecOps Triage & Root Cause
            </h4>
          </div>
          <span className="text-[11px] font-mono text-[#526D61] bg-[#EBF4F0] px-2 py-0.5 rounded">
            Ensemble Decision Path
          </span>
        </div>

        {aiReport ? (
          <div className="space-y-4 text-xs">
            {/* Taxonomy & Root cause */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#637D72] block mb-1">
                Taxonomy Classification
              </span>
              <p className="font-medium text-[#0F3D2E]">{aiReport.attackTaxonomy}</p>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#637D72] block mb-1">
                Root Cause Heuristics
              </span>
              <p className="text-[#385145] leading-relaxed">
                {aiReport.rootCauseAnalysis}
              </p>
            </div>

            {/* Feature attribution table */}
            {aiReport.keyFeatures && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#637D72] block mb-2">
                  Salient Feature Contributions (SHAP)
                </span>
                <div className="border border-[#E2EBE5] rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left">
                    <thead className="bg-[#FAFBF8] border-b border-[#E2EBE5] text-[11px] text-[#526D61]">
                      <tr>
                        <th className="p-2 font-medium">Feature</th>
                        <th className="p-2 font-medium">Observed</th>
                        <th className="p-2 font-medium">Baseline</th>
                        <th className="p-2 font-medium">Contribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF4F0] text-[11px]">
                      {aiReport.keyFeatures.map((kf, i) => (
                        <tr key={i}>
                          <td className="p-2 font-mono font-medium text-[#0F3D2E]">{kf.feature}</td>
                          <td className="p-2 font-mono text-[#DC2626]">{kf.value}</td>
                          <td className="p-2 text-[#637D72]">{kf.benchmark}</td>
                          <td className="p-2 font-medium text-[#0F3D2E]">{kf.contribution}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mitigation with Copyable Command */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#637D72] block mb-1 flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-[#0F3D2E]" />
                Recommended Host / Edge Mitigation
              </span>
              {aiReport.recommendedMitigation?.map((m, idx) => (
                <div key={idx} className="space-y-2 mt-2">
                  <p className="text-[#385145]">{m.step}</p>
                  {m.iptablesRule && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-[#526D61]">Firewall Drop:</span>
                      <MarkdownView content={`\`\`\`bash\n${m.iptablesRule}\n\`\`\``} />
                    </div>
                  )}
                  {m.snortRule && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-[#526D61]">IDS Signature:</span>
                      <MarkdownView content={`\`\`\`snort\n${m.snortRule}\n\`\`\``} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#526D61] italic">
            Generating real-time explanation for this incident telemetry...
          </div>
        )}
      </div>

      {/* Footer quick action buttons */}
      <div className="pt-2 flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs font-medium border border-[#E2EBE5] text-[#526D61] hover:bg-[#FAFBF8] transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={() => {
            handleStatusChange('resolved')
            onClose()
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#0F3D2E] text-white hover:bg-[#16533F] transition-colors shadow-xs"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
          Mark Resolved & Close
        </button>
      </div>
    </Drawer>
  )
}
