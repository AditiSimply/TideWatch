import { Shield, GitBranch, Database } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="relative z-10 border-t border-[#E2EBE5] bg-white/70 backdrop-blur-xs mt-16 text-xs text-[#526D61]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Shield className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="font-display font-semibold text-[#0F3D2E]">
              Tidewatch ML-NIDS
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FAFBF8] border border-[#E2EBE5] text-[#526D61]">
              v2.4-calibrated
            </span>
          </div>
          <p className="text-[11px] text-[#637D72] max-w-md leading-relaxed">
            Real-time ML network intrusion detection system calibrated on Canadian Institute for Cybersecurity
            CICIDS2017 flow telemetry. Zero payload inspection required.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5 text-[#405B50]">
            <Database className="w-3.5 h-3.5 text-[#10B981]" />
            <span>CICIDS2017 78-dim Vector</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#405B50]">
            <GitBranch className="w-3.5 h-3.5 text-[#10B981]" />
            <span>FastAPI Interchange Ready</span>
          </div>
          <span className="text-[#A7C4B5]">•</span>
          <span className="font-mono text-[#0F3D2E]">
            VITE_API_URL: {import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : '(mocked)'}
          </span>
        </div>
      </div>
    </footer>
  )
}
