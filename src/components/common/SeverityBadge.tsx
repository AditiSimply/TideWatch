import React from 'react'
import type { Severity } from '@/types'
import { getSeverityConfig } from '@/lib/utils'

interface SeverityBadgeProps {
  severity: Severity
  className?: string
  showDot?: boolean
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  className = '',
  showDot = true,
}) => {
  const config = getSeverityConfig(severity)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-tight border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`}
          aria-hidden="true"
        />
      )}
      <span>{config.label}</span>
    </span>
  )
}
