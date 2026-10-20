import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { BarChartSkeleton } from '@/components/common/Skeleton'
import type { TopIpMetric } from '@/types'

interface TopIpsBarChartProps {
  data: TopIpMetric[]
  isLoading?: boolean
  onSelectIp?: (ip: string) => void
}

export const TopIpsBarChart: React.FC<TopIpsBarChartProps> = ({
  data,
  isLoading,
  onSelectIp,
}) => {
  if (isLoading) {
    return <BarChartSkeleton />
  }

  return (
    <div className="editorial-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-[#0F3D2E] tracking-tight">
            Top Flagged Adversary IPs
          </h3>
          <p className="text-xs text-[#637D72] mt-0.5">
            Ranked by aggregate suspicious flow volume and threat score
          </p>
        </div>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: '#E2EBE5' }}
              tick={{ fill: '#637D72', fontSize: 11 }}
            />
            <YAxis
              dataKey="ip"
              type="category"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#0F3D2E', fontSize: 11, fontFamily: 'monospace' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const item = payload[0].payload as TopIpMetric
                return (
                  <div className="bg-white/95 backdrop-blur-xs border border-[#D5E3DC] rounded-lg shadow-md p-3 text-xs">
                    <div className="font-mono font-semibold text-[#0F3D2E]">{item.ip}</div>
                    <div className="text-[#526D61] text-[11px] mb-1.5">{item.country}</div>
                    <div className="space-y-1 pt-1 border-t border-[#EEF4F0]">
                      <div className="flex justify-between gap-4">
                        <span className="text-[#637D72]">Flows:</span>
                        <span className="font-mono font-medium">{item.flowsCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-[#637D72]">Threat Score:</span>
                        <span className="font-mono font-medium text-[#DC2626]">{item.threatScore}/100</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-[#637D72]">Vector:</span>
                        <span className="text-[#0F3D2E] font-medium">{item.primaryAttack}</span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="flowsCount"
              radius={[0, 4, 4, 0]}
              onClick={(entry: unknown) => {
                const item = entry as TopIpMetric | undefined
                if (onSelectIp && item?.ip) onSelectIp(item.ip)
              }}
              className="cursor-pointer"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`ip-cell-${index}`}
                  fill={entry.threatScore >= 90 ? '#DC2626' : entry.threatScore >= 80 ? '#EA580C' : '#D97706'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-3 border-t border-[#EEF4F0] flex flex-wrap gap-2 text-xs">
        {data.map((item) => (
          <button
            key={item.ip}
            onClick={() => onSelectIp && onSelectIp(item.ip)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FAFBF8] border border-[#E2EBE5] hover:border-[#10B981] transition-colors"
          >
            <span className="font-mono text-[#0F3D2E] font-medium">{item.ip}</span>
            <span className="text-[10px] text-[#526D61] px-1 rounded bg-[#EBF3EF]">
              {item.flowsCount} flw
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
