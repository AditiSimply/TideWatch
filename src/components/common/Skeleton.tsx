import React from 'react'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => {
  return (
    <div
      className={`animate-pulse bg-[#EAF1EC] rounded-md ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => {
  return (
    <div className="space-y-3 p-4">
      <div className="flex gap-4 mb-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2 border-b border-[#F0F5F2]">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export const CardSkeleton: React.FC = () => {
  return (
    <div className="editorial-card p-6 space-y-4">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

export const ChartSkeleton: React.FC<{ heightClass?: string }> = ({
  heightClass = 'h-[380px]',
}) => {
  return (
    <div className={`editorial-card p-6 ${heightClass} flex flex-col justify-between`}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-6 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-64" />
      </div>

      {/* Legend skeleton */}
      <div className="flex items-center gap-6 my-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Chart grid and wave skeleton */}
      <div className="flex-1 flex flex-col justify-end gap-3 pt-4 border-b border-[#E2EBE5]">
        <div className="flex items-end justify-between gap-2 h-44 px-2">
          {[40, 65, 30, 85, 45, 90, 60, 75, 50, 95, 70, 80].map((h, idx) => (
            <div key={idx} className="flex-1 flex flex-col justify-end gap-1.5 h-full">
              <Skeleton
                className="w-full rounded-t-sm"
                style={{ height: `${h}%` } as React.CSSProperties}
              />
            </div>
          ))}
        </div>
      </div>

      {/* X-axis labels skeleton */}
      <div className="flex justify-between pt-2">
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-10" />
      </div>
    </div>
  )
}

export const DonutSkeleton: React.FC = () => {
  return (
    <div className="editorial-card p-6 h-[380px] flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-3 w-44" />
      </div>

      {/* Donut circle skeleton */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="w-36 h-36 rounded-full border-12 border-[#EAF1EC] animate-pulse flex items-center justify-center">
          <Skeleton className="w-14 h-4 rounded-md" />
        </div>
      </div>

      {/* Legend list skeleton */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  )
}

export const BarChartSkeleton: React.FC = () => {
  return (
    <div className="editorial-card p-6 h-[340px] flex flex-col justify-between">
      <div className="space-y-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-56" />
      </div>

      <div className="space-y-3.5 my-4">
        {[85, 68, 52, 40, 25].map((w, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton
              className="h-2 rounded-full"
              style={{ width: `${w}%` } as React.CSSProperties}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2 border-t border-[#EEF4F0]">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  )
}
