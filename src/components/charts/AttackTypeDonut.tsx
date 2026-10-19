import React from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import type { AttackDistribution } from '@/types'

interface AttackTypeDonutProps {
  data: AttackDistribution[]
  isLoading?: boolean
}

const PALETTE = ['#DC2626', '#EA580C', '#D97706', '#92400E', '#059669', '#0F3D2E']

export const AttackTypeDonut: React.FC<AttackTypeDonutProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="editorial-card p-6 h-[380px] flex items-center justify-center">
        <span className="text-xs text-[#526D61] animate-pulse">Loading attack taxonomy...</span>
      </div>
    )
  }

  const total = data.reduce((acc, curr) => acc + curr.count, 0)

  return (
    <div className="editorial-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-[#0F3D2E] tracking-tight">
            Attack Classification
          </h3>
          <span className="text-xs text-[#637D72]">{total.toLocaleString()} total</span>
        </div>
        <p className="text-xs text-[#637D72] mt-0.5">
          Proportional breakdown of detected intrusions
        </p>
      </div>

      <div className="relative h-[200px] w-full my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const item = payload[0].payload as AttackDistribution
                return (
                  <div className="bg-white/95 backdrop-blur-xs border border-[#D5E3DC] rounded-lg shadow-md px-3 py-2 text-xs">
                    <span className="font-semibold text-[#0F3D2E] block">{item.name}</span>
                    <span className="text-[#526D61] font-mono">
                      {item.count.toLocaleString()} flows ({item.percentage}%)
                    </span>
                  </div>
                )
              }}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              stroke="transparent"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={entry.color || PALETTE[index % PALETTE.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] uppercase tracking-wider text-[#637D72] font-semibold">
            Primary
          </span>
          <span className="font-display text-base font-bold text-[#0F3D2E]">
            {data[0]?.name || 'DDoS'}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-[#EEF4F0]">
        {data.slice(0, 4).map((item, idx) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color || PALETTE[idx % PALETTE.length] }}
              />
              <span className="text-[#385145] truncate font-medium">{item.name}</span>
            </div>
            <span className="font-mono text-[#637D72] ml-1">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
