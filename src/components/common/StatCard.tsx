import React from 'react'
import { useCountUp } from '@/hooks/useCountUp'
import { formatNumber } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number | string
  isNumeric?: boolean
  prefix?: string
  suffix?: string
  subtext: string
  trend?: {
    value: string
    isPositive?: boolean
    neutral?: boolean
  }
  badge?: string
  className?: string
  actionSlot?: React.ReactNode
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  isNumeric = true,
  prefix = '',
  suffix = '',
  subtext,
  trend,
  badge,
  className = '',
  actionSlot,
}) => {
  const numericVal = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  const animatedNumber = useCountUp(isNaN(numericVal) ? 0 : numericVal, 900)

  const displayValue = isNumeric && typeof value === 'number'
    ? `${prefix}${formatNumber(animatedNumber)}${suffix}`
    : `${prefix}${value}${suffix}`

  return (
    <div
      className={`editorial-card editorial-card-hover p-6 flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-[#405B50]">
            {label}
          </span>
          {badge && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EBF4F0] text-[#0F3D2E] border border-[#D5E3DC]">
              {badge}
            </span>
          )}
          {actionSlot}
        </div>

        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-display text-3xl sm:text-4xl font-semibold text-[#0F3D2E] tracking-tight">
            {displayValue}
          </span>
          {trend && (
            <span
              className={`text-xs font-medium inline-flex items-center gap-0.5 ${
                trend.neutral
                  ? 'text-[#405B50]'
                  : trend.isPositive
                    ? 'text-[#10B981]'
                    : 'text-[#DC2626]'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-[#637D72] mt-4 pt-3 border-t border-[#EEF4F0] leading-relaxed">
        {subtext}
      </p>
    </div>
  )
}
