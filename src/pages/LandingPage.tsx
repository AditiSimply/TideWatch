import React from 'react'
import { Link } from 'react-router-dom'
import { useLiveFeed } from '@/hooks/useLiveFeed'
import {
  ShieldCheck,
  Activity,
  ArrowRight,
  Bot,
  FileSpreadsheet,
} from 'lucide-react'

export const LandingPage: React.FC = () => {
  const { kpis } = useLiveFeed()

  return (
    <div className="space-y-16 py-6 sm:py-12">
      {/* Hero Section */}
      <section className="relative text-left max-w-4xl space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF4F0] border border-[#D5E3DC] text-xs font-medium text-[#0F3D2E]">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse-subtle" />
          <span>Continuous ML Flow Telemetry</span>
          <span className="text-[#A7C4B5]">•</span>
          <span className="text-[#405B50]">Trained on CICIDS2017</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl font-bold text-[#0F3D2E] tracking-tight leading-[1.08]">
          Network intrusion detection calibrated on flow telemetry, not static signatures.
        </h1>

        <p className="text-lg sm:text-xl text-[#3E574B] max-w-2xl font-normal leading-relaxed">
          Tidewatch classifies zero-day network threats, DDoS floods, and stealthy lateral reconnaissance in 3.8ms per flow—without decrypting TLS payloads or inspecting user content.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[#0F3D2E] text-white hover:bg-[#16533F] transition-all shadow-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Open dashboard</span>
            <ArrowRight className="w-4 h-4 text-[#10B981]" />
          </Link>

          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-white text-[#0F3D2E] border border-[#D5E3DC] hover:border-[#10B981] transition-all shadow-2xs hover:-translate-y-0.5 active:translate-y-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#405B50]" />
            <span>Try demo dataset</span>
          </Link>

          <Link
            to="/assistant"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-[#405B50] hover:text-[#0F3D2E] transition-colors"
          >
            <Bot className="w-4 h-4 text-[#10B981]" />
            <span>Query AI Assistant</span>
          </Link>
        </div>

        {/* Live Stats Strip */}
        <div className="pt-8">
          <div className="editorial-card p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EEF4F0]">
            <div className="sm:pr-4">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Active Ingress Flows
              </span>
              <span className="font-display text-2xl font-bold text-[#0F3D2E] mt-1 block">
                {kpis.totalFlows.toLocaleString()}
              </span>
              <span className="text-[11px] text-[#526D61] mt-0.5 block">
                {kpis.flowsLastMinute.toLocaleString()} flows / min
              </span>
            </div>

            <div className="pt-3 sm:pt-0 sm:px-4">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Mean Inference Latency
              </span>
              <span className="font-display text-2xl font-bold text-[#0F3D2E] mt-1 block">
                3.8 ms
              </span>
              <span className="text-[11px] text-[#10B981] font-medium mt-0.5 block">
                Line-rate evaluation
              </span>
            </div>

            <div className="pt-3 sm:pt-0 sm:px-4">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                False Positive Rate
              </span>
              <span className="font-display text-2xl font-bold text-[#0F3D2E] mt-1 block">
                0.03%
              </span>
              <span className="text-[11px] text-[#526D61] mt-0.5 block">
                3 per 10,000 benign flows
              </span>
            </div>

            <div className="pt-3 sm:pt-0 sm:pl-4">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Ensemble F1-Score
              </span>
              <span className="font-display text-2xl font-bold text-[#0F3D2E] mt-1 block">
                99.82%
              </span>
              <span className="text-[11px] text-[#526D61] mt-0.5 block">
                Calibrated on 2.8M flows
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Feature Grid: Mixed sizes, Hand-built rhythm */}
      <section className="space-y-6 pt-6">
        <div className="text-left max-w-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#0F3D2E] tracking-tight">
            Engineered for modern encrypted enterprise networks.
          </h2>
          <p className="text-sm text-[#526D61] mt-1.5 leading-relaxed">
            Legacy DPI systems collapse when traffic is encrypted with TLS 1.3. Tidewatch analyzes statistical packet arrival patterns, inter-arrival intervals, and bidirectional window sizes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1: Large feature */}
          <div className="md:col-span-7 editorial-card editorial-card-hover p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#EBF4F0] text-[#0F3D2E] flex items-center justify-center border border-[#D5E3DC]">
                <Activity className="w-5 h-5 text-[#10B981]" />
              </div>
              <h3 className="font-display text-xl font-semibold text-[#0F3D2E]">
                78-Dimensional Flow Telemetry
              </h3>
              <p className="text-sm text-[#3E574B] leading-relaxed">
                Rather than string matching regexes on packet bodies, Tidewatch ingests NetFlow/IPFIX vectors. Features like <span className="font-mono text-xs bg-[#F2F7F4] px-1 py-0.5 rounded">Flow IAT Mean</span>, <span className="font-mono text-xs bg-[#F2F7F4] px-1 py-0.5 rounded">Init_Win_bytes_forward</span>, and <span className="font-mono text-xs bg-[#F2F7F4] px-1 py-0.5 rounded">Bwd Packet Length Std</span> catch automated attack machinery regardless of encryption.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#EEF4F0] flex items-center justify-between text-xs text-[#526D61]">
              <span>Zero SSL/TLS decapsulation overhead</span>
              <Link to="/model" className="font-medium text-[#0F3D2E] hover:text-[#10B981] inline-flex items-center gap-1">
                Explore feature weights <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Card 2: Medium feature */}
          <div className="md:col-span-5 editorial-card editorial-card-hover p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#EBF4F0] text-[#0F3D2E] flex items-center justify-center border border-[#D5E3DC]">
                <ShieldCheck className="w-5 h-5 text-[#10B981]" />
              </div>
              <h3 className="font-display text-xl font-semibold text-[#0F3D2E]">
                Instant Root-Cause & IPTables
              </h3>
              <p className="text-sm text-[#3E574B] leading-relaxed">
                Every detected anomaly auto-generates SHAP attribution graphs and one-click mitigation rules for IPTables, Linux nftables, and Snort/Suricata sensor endpoints.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#EEF4F0] flex items-center justify-between text-xs text-[#526D61]">
              <span>Immediate host isolation</span>
              <Link to="/alerts" className="font-medium text-[#0F3D2E] hover:text-[#10B981] inline-flex items-center gap-1">
                Review alert feed <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Card 3: Interactive Demo Upload strip */}
          <div className="md:col-span-12 editorial-card p-6 sm:p-8 bg-gradient-to-r from-white via-[#F8FAF9] to-white border border-[#D5E3DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <span className="text-xs font-mono uppercase tracking-wider text-[#10B981] font-semibold">
                Self-Service Test Bench
              </span>
              <h3 className="font-display text-xl font-semibold text-[#0F3D2E]">
                Analyze your own PCAP or CICIDS2017 CSV captures
              </h3>
              <p className="text-sm text-[#3E574B]">
                Drop any CSV exported from CICFlowMeter or Wireshark to run inference against our tree ensemble in real time.
              </p>
            </div>

            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#0F3D2E] text-white hover:bg-[#16533F] transition-all shadow-xs shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
              <span>Launch CSV analyzer</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
