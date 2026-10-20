import React, { useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSimulation } from '@/hooks/useSimulation'
import { api } from '@/lib/api'
import {
  Shield,
  Activity,
  Play,
  Pause,
  Zap,
  Menu,
  X,
  FileSpreadsheet,
  AlertOctagon,
  Bot,
  Cpu,
} from 'lucide-react'

export const Navbar: React.FC = () => {
  const { isRunning, speedMultiplier, toggleRunning, setSpeed, triggerAttackBurst } =
    useSimulation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  // Fetch LLM provider health and status
  const { data: llmStatus } = useQuery({
    queryKey: ['llmStatus'],
    queryFn: () => api.getLlmStatus(),
    refetchInterval: 20000,
    staleTime: 10000,
  })

  const handleToggleRunning = async () => {
    const nextAction = isRunning ? 'stop' : 'start'
    try {
      await api.controlStream(nextAction)
    } catch (e) {
      console.warn('POST /stream/control failed:', e)
    }
    toggleRunning()
  }

  const navItems = [
    { label: 'Overview', to: '/' },
    { label: 'Dashboard', to: '/dashboard', icon: Activity },
    { label: 'Analyze', to: '/analyze', icon: FileSpreadsheet },
    { label: 'Alerts', to: '/alerts', icon: AlertOctagon },
    { label: 'Assistant', to: '/assistant', icon: Bot },
    { label: 'Model', to: '/model', icon: Cpu },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E2EBE5] bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 group focus:outline-none"
            aria-label="Tidewatch Home"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0F3D2E] text-white flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs">
              <Shield className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold text-[#0F3D2E] tracking-tight leading-none">
                Tidewatch
              </span>
              <span className="text-[10px] font-mono text-[#526D61] tracking-wider uppercase mt-0.5">
                NIDS Telemetry
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#EBF4F0] text-[#0F3D2E] font-semibold'
                      : 'text-[#4B6358] hover:text-[#0F3D2E] hover:bg-[#F2F7F4]'
                  }`}
                >
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Right side: Simulation controls & LLM Status Badge */}
        <div className="hidden sm:flex items-center gap-3">
          {/* LLM Status Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAFBF8] border border-[#E2EBE5] text-[11px] hover:border-[#10B981] transition-colors cursor-help"
            title={`Active LLM: ${llmStatus?.provider || 'Groq'} (${llmStatus?.model || 'llama-3.3-70b-versatile'}) — ${
              llmStatus?.healthy ? 'Connected & Healthy' : 'Degraded / Offline'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                llmStatus?.healthy ? 'bg-[#10B981] shadow-xs' : 'bg-red-500 shadow-xs'
              }`}
            />
            <span className="font-mono text-[#0F3D2E] font-medium uppercase">
              {llmStatus?.provider || 'LLM'}
            </span>
            <span className="text-[9px] text-[#526D61] font-mono border-l border-[#E2EBE5] pl-1.5">
              {llmStatus?.model?.split('/')?.pop()?.slice(0, 14) || 'AI'}
            </span>
          </div>

          {/* Live stream status indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAFBF8] border border-[#E2EBE5] text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-[#10B981] animate-pulse-subtle' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-[#405B50]">
              {isRunning ? 'FEED ACTIVE' : 'STREAM PAUSED'}
            </span>
          </div>

          {/* Simulation Toggle & Controls */}
          <div className="flex items-center rounded-lg border border-[#E2EBE5] bg-[#FAFBF8] p-1 gap-1">
            <button
              onClick={handleToggleRunning}
              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs font-medium ${
                isRunning
                  ? 'bg-white text-[#0F3D2E] shadow-2xs border border-[#D5E3DC]'
                  : 'bg-emerald-50 text-[#0F3D2E] border border-emerald-200'
              }`}
              title={isRunning ? 'Pause stream (POST /stream/control)' : 'Resume stream (POST /stream/control)'}
              aria-label={isRunning ? 'Pause simulation' : 'Play simulation'}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-[#405B50]" />
                  <span className="hidden lg:inline text-[11px]">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-[#10B981]" />
                  <span className="hidden lg:inline text-[11px]">Replay</span>
                </>
              )}
            </button>

            {/* Speed Multiplier */}
            <div className="flex items-center border-l border-[#E2EBE5] pl-1 ml-0.5">
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeed(spd)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                    speedMultiplier === spd
                      ? 'bg-[#0F3D2E] text-white font-semibold'
                      : 'text-[#637D72] hover:text-[#0F3D2E]'
                  }`}
                  title={`Run simulation at ${spd}x speed`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Burst Attack Button */}
          <button
            onClick={() => triggerAttackBurst()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FAFBF8] hover:bg-[#F2F7F4] text-[#0F3D2E] border border-[#D5E3DC] transition-all hover:-translate-y-0.5 active:translate-y-0"
            title="Inject an attack burst to test real-time alert trigger"
          >
            <Zap className="w-3.5 h-3.5 text-[#DC2626]" />
            <span className="hidden md:inline">Inject Threat</span>
          </button>
        </div>

        {/* Mobile menu hamburger */}
        <div className="flex items-center sm:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-[#0F3D2E] hover:bg-[#EBF3EF] transition-colors"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-[#E2EBE5] bg-white px-4 py-3 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-[#0F3D2E] hover:bg-[#EBF4F0]"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-[#E2EBE5] flex items-center justify-between">
            <span className="text-xs text-[#526D61]">Simulation:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleRunning}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#FAFBF8] border border-[#D5E3DC]"
              >
                {isRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={() => {
                  triggerAttackBurst()
                  setMobileMenuOpen(false)
                }}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#DC2626] text-white"
              >
                Inject Attack
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
