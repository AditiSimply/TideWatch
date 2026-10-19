import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Severity, AttackClass } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

export function formatPercent(val: number, decimals: number = 1): string {
  return `${(val * 100).toFixed(decimals)}%`
}

export function formatDurationUs(us: number): string {
  if (us < 1000) return `${us} µs`
  if (us < 1_000_000) return `${(us / 1000).toFixed(1)} ms`
  return `${(us / 1_000_000).toFixed(2)} s`
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function timeAgo(timestamp: string): string {
  const now = new Date().getTime()
  const then = new Date(timestamp).getTime()
  const seconds = Math.max(1, Math.floor((now - then) / 1000))

  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function getSeverityConfig(severity: Severity): {
  label: string
  bg: string
  text: string
  border: string
  dot: string
} {
  switch (severity) {
    case 'critical':
      return {
        label: 'Critical',
        bg: 'bg-red-50',
        text: 'text-red-800',
        border: 'border-red-200',
        dot: 'bg-red-600',
      }
    case 'high':
      return {
        label: 'High',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        dot: 'bg-amber-600',
      }
    case 'medium':
      return {
        label: 'Medium',
        bg: 'bg-amber-50/60',
        text: 'text-amber-700',
        border: 'border-amber-200/60',
        dot: 'bg-amber-500',
      }
    case 'low':
      return {
        label: 'Low',
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        dot: 'bg-emerald-600',
      }
    case 'benign':
    default:
      return {
        label: 'Benign',
        bg: 'bg-emerald-50/40',
        text: 'text-[#1C5140]',
        border: 'border-emerald-200/50',
        dot: 'bg-emerald-500',
      }
  }
}

export function getSeverityForAttack(attack: AttackClass): Severity {
  switch (attack) {
    case 'DDoS-LOIC':
    case 'Infiltration':
      return 'critical'
    case 'DoS-GoldenEye':
    case 'Botnet':
    case 'Web Attack - SQL Injection':
      return 'high'
    case 'DoS-Slowloris':
    case 'PortScan':
    case 'Web Attack - Brute Force':
    case 'Web Attack - XSS':
      return 'medium'
    case 'BENIGN':
    default:
      return 'benign'
  }
}
