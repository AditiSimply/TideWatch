import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="editorial-card p-12 text-center max-w-md mx-auto my-16 space-y-4">
      <div className="w-12 h-12 rounded-full bg-[#EBF4F0] text-[#0F3D2E] flex items-center justify-center mx-auto border border-[#D5E3DC]">
        <ShieldAlert className="w-6 h-6 text-[#10B981]" />
      </div>
      <h2 className="font-display text-2xl font-bold text-[#0F3D2E]">
        Endpoint Not Found
      </h2>
      <p className="text-xs text-[#526D61] leading-relaxed">
        The requested telemetry view or route does not exist in the Tidewatch routing table.
      </p>
      <div className="pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0F3D2E] text-white hover:bg-[#16533F] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  )
}
