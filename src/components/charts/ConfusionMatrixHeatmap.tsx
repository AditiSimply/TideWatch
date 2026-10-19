import React, { useState } from 'react'
import type { ConfusionMatrixData, AttackClass } from '@/types'

interface ConfusionMatrixHeatmapProps {
  data: ConfusionMatrixData
}

export const ConfusionMatrixHeatmap: React.FC<ConfusionMatrixHeatmapProps> = ({ data }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    row: number
    col: number
    trueLabel: AttackClass
    predLabel: AttackClass
    value: number
    rowTotal: number
  } | null>(null)

  const { labels, matrix } = data

  // Row totals for percentage calculation
  const rowTotals = matrix.map((row) => row.reduce((sum, val) => sum + val, 0))

  return (
    <div className="editorial-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-[#0F3D2E] tracking-tight">
            Confusion Matrix Heatmap
          </h3>
          <p className="text-xs text-[#637D72] mt-0.5">
            Validation set evaluation on 2,569,879 labeled network flows
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#10B981]" />
            <span className="text-[#385145]">High Precision Match</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#FEE2E2] border border-[#FECACA]" />
            <span className="text-[#385145]">Off-diagonal Error</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          <div className="flex">
            {/* Y-axis label */}
            <div className="w-8 flex items-center justify-center">
              <span className="transform -rotate-90 text-[11px] font-semibold tracking-wider text-[#405B50] uppercase whitespace-nowrap">
                True Label
              </span>
            </div>

            <div className="flex-1">
              {/* Column headers (Predicted labels) */}
              <div className="grid grid-cols-7 gap-1.5 mb-1.5 pl-28">
                {labels.map((label) => (
                  <div
                    key={`header-${label}`}
                    className="text-center text-[11px] font-semibold text-[#405B50] truncate px-1"
                    title={label}
                  >
                    {label.replace('DoS-', '').replace('DDoS-', '')}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                {matrix.map((row, rIdx) => {
                  const trueLabel = labels[rIdx]
                  const rowSum = rowTotals[rIdx]

                  return (
                    <div key={`row-${rIdx}`} className="flex items-center gap-1.5">
                      {/* Row header */}
                      <div
                        className="w-28 text-right text-xs font-medium text-[#0F3D2E] truncate pr-2"
                        title={trueLabel}
                      >
                        {trueLabel}
                      </div>

                      {/* Cells */}
                      <div className="grid grid-cols-6 gap-1.5 flex-1">
                        {row.map((val, cIdx) => {
                          const predLabel = labels[cIdx]
                          const isDiagonal = rIdx === cIdx
                          const pct = rowSum > 0 ? (val / rowSum) * 100 : 0

                          // Calculate background color
                          let bgStyle = 'bg-white border-[#E2EBE5]'
                          let textStyle = 'text-[#637D72]'

                          if (isDiagonal) {
                            if (pct > 99) bgStyle = 'bg-[#10B981] text-white border-transparent'
                            else if (pct > 95) bgStyle = 'bg-[#34D399] text-[#0F3D2E] border-transparent'
                            else bgStyle = 'bg-[#A7F3D0] text-[#0F3D2E] border-transparent'
                            textStyle = pct > 99 ? 'text-white font-semibold' : 'text-[#0F3D2E] font-semibold'
                          } else if (val > 0) {
                            bgStyle = 'bg-red-50/80 border-red-200 text-red-900 font-medium'
                            textStyle = 'text-red-900'
                          }

                          return (
                            <div
                              key={`cell-${rIdx}-${cIdx}`}
                              onMouseEnter={() =>
                                setHoveredCell({
                                  row: rIdx,
                                  col: cIdx,
                                  trueLabel,
                                  predLabel,
                                  value: val,
                                  rowTotal: rowSum,
                                })
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                              className={`h-11 rounded-md border flex flex-col items-center justify-center p-1 cursor-pointer transition-transform hover:scale-[1.04] ${bgStyle}`}
                            >
                              <span className={`text-[11px] font-mono leading-none ${textStyle}`}>
                                {val >= 1000000
                                  ? `${(val / 1000000).toFixed(1)}M`
                                  : val >= 1000
                                  ? `${(val / 1000).toFixed(0)}k`
                                  : val}
                              </span>
                              <span className={`text-[9px] mt-0.5 opacity-80 ${textStyle}`}>
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* X-axis label */}
              <div className="text-center mt-3 pl-28">
                <span className="text-[11px] font-semibold tracking-wider text-[#405B50] uppercase">
                  Predicted Label
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hovered cell detail strip */}
      <div className="mt-4 p-3 rounded-lg bg-[#FAFBF8] border border-[#E2EBE5] text-xs flex flex-wrap items-center justify-between min-h-[44px]">
        {hoveredCell ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[#637D72]">True Class:</span>
              <span className="font-semibold text-[#0F3D2E]">{hoveredCell.trueLabel}</span>
              <span className="text-[#A7C4B5]">→</span>
              <span className="text-[#637D72]">Predicted:</span>
              <span className="font-semibold text-[#0F3D2E]">{hoveredCell.predLabel}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[#0F3D2E] font-medium">
                {hoveredCell.value.toLocaleString()} flows
              </span>
              <span className="px-2 py-0.5 rounded bg-[#EBF3EF] text-[#0F3D2E] font-mono text-[11px]">
                {((hoveredCell.value / hoveredCell.rowTotal) * 100).toFixed(2)}% of true class
              </span>
            </div>
          </>
        ) : (
          <span className="text-[#637D72] italic">
            Hover over any cell to inspect true vs predicted classification counts and recall rates
          </span>
        )}
      </div>
    </div>
  )
}
