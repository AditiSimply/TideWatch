import React, { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { TrafficDataPoint } from '@/types'

interface TrafficLineChartProps {
  data: TrafficDataPoint[]
  isLoading?: boolean
}

export const TrafficLineChart: React.FC<TrafficLineChartProps> = ({ data, isLoading }) => {
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '6h' | '24h'>('1h')

  if (isLoading) {
    return (
      <div className="editorial-card p-6 h-[380px] flex items-center justify-center">
        <span className="text-xs text-[#526D61] animate-pulse">Loading traffic telemetry...</span>
      </div>
    )
  }

  return (
    <div className="editorial-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-[#0F3D2E] tracking-tight">
              Ingress Traffic & Threat Density
            </h3>
            <span className="text-[11px] font-mono text-[#526D61] bg-[#F2F7F4] px-2 py-0.5 rounded border border-[#E0EBE4]">
              flows / 5m
            </span>
          </div>
          <p className="text-xs text-[#637D72] mt-0.5">
            Normal application flows vs anomalous attack signatures
          </p>
        </div>

        {/* Time range selector */}
        <div className="inline-flex rounded-lg border border-[#E2EBE5] bg-[#FAFBF8] p-0.5 self-start sm:self-auto">
          {(['15m', '1h', '6h', '24h'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                timeRange === r
                  ? 'bg-white text-[#0F3D2E] shadow-xs border border-[#D5E3DC]'
                  : 'text-[#526D61] hover:text-[#0F3D2E]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Legend & quick indicators */}
      <div className="flex items-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
          <span className="text-[#385145] font-medium">Normal Telemetry</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#DC2626]" />
          <span className="text-[#385145] font-medium">Attack Flows</span>
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="benignGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="attackGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBF1ED" />
            <XAxis
              dataKey="timeLabel"
              tickLine={false}
              axisLine={{ stroke: '#E2EBE5' }}
              tick={{ fill: '#637D72', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#637D72', fontSize: 11 }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null
                const benign = payload.find((p) => p.dataKey === 'benignFlows')?.value || 0
                const attacks = payload.find((p) => p.dataKey === 'attackFlows')?.value || 0
                return (
                  <div className="bg-white/95 backdrop-blur-xs border border-[#D5E3DC] rounded-lg shadow-md p-3 text-xs min-w-[150px]">
                    <div className="font-semibold text-[#0F3D2E] border-b border-[#EEF4F0] pb-1.5 mb-2">
                      Time: {label}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[#1C5140]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                          Benign:
                        </span>
                        <span className="font-mono font-medium">{benign.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-[#991B1B]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                          Attacks:
                        </span>
                        <span className="font-mono font-medium">{attacks.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="benignFlows"
              stroke="#10B981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#benignGrad)"
            />
            <Area
              type="monotone"
              dataKey="attackFlows"
              stroke="#DC2626"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#attackGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
