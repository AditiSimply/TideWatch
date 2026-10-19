import React from 'react'
import { ShieldCheck } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="editorial-card p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto my-8">
      <div className="w-12 h-12 rounded-full bg-[#EBF4F0] text-[#0F3D2E] flex items-center justify-center mb-4 border border-[#D3E3DA]">
        {icon || <ShieldCheck className="w-6 h-6 text-[#10B981]" />}
      </div>
      <h3 className="font-display text-lg font-semibold text-[#0F3D2E] mb-1">
        {title}
      </h3>
      <p className="text-sm text-[#526D61] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-[#0F3D2E] text-white hover:bg-[#16533F] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-1"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
