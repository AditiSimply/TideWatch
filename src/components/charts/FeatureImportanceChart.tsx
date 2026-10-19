import React from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import type { FeatureImportance } from '@/types'

interface FeatureImportanceChartProps {
  data: FeatureImportance[]
}

export const FeatureImportanceChart: React.FC<FeatureImportanceChartProps> = ({ data }) => {
  return (
    <div className="editorial-card p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-[#0F3D2E] tracking-tight">
          Tree-Split Feature Importance (Gini & SHAP)
        </h3>
        <p className="text-xs text-[#637D72] mt-0.5">
          Top discriminative dimensions from the 78-feature CICIDS2017 vector space
        </p>
      </div>

      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <XAxis
              type="number"
              domain={[0, 0.22]}
              tickLine={false}
              axisLine={{ stroke: '#E2EBE5' }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: '#637D72', fontSize: 11 }}
            />
            <YAxis
              dataKey="displayName"
              type="category"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#0F3D2E', fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const feat = payload[0].payload as FeatureImportance
                return (
                  <div className="bg-white/95 backdrop-blur-xs border border-[#D5E3DC] rounded-lg shadow-md p-3 text-xs max-w-xs">
                    <span className="font-semibold text-[#0F3D2E] block">{feat.displayName}</span>
                    <span className="font-mono text-[#10B981] font-medium block my-1">
                      Importance: {(feat.importance * 100).toFixed(1)}%
                    </span>
                    <p className="text-[#526D61] text-[11px] leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
              {data.map((_, index) => {
                // Color scale from deep forest to emerald to sage
                const colors = ['#0F3D2E', '#16533F', '#1C664E', '#10B981', '#34D399', '#6EE7B7', '#A7C4B5', '#CBDAD1']
                return <Cell key={`feat-${index}`} fill={colors[index % colors.length]} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
