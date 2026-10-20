import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

export interface ToastItem {
  id: string
  message: string
  code?: string
  type: 'error' | 'success' | 'info' | 'warning'
  duration?: number
}

type ToastListener = (toasts: ToastItem[]) => void

class ToastManager {
  private toasts: ToastItem[] = []
  private listeners: ToastListener[] = []

  subscribe(listener: ToastListener) {
    this.listeners.push(listener)
    listener([...this.toasts])
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.toasts]))
  }

  show(item: Omit<ToastItem, 'id'>) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newToast: ToastItem = { ...item, id }
    this.toasts = [...this.toasts, newToast]
    this.notify()

    const duration = item.duration ?? (item.type === 'error' ? 5500 : 4000)
    setTimeout(() => {
      this.dismiss(id)
    }, duration)
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id)
    this.notify()
  }

  error(message: string, code?: string) {
    this.show({ message, code, type: 'error' })
  }

  success(message: string) {
    this.show({ message, type: 'success' })
  }

  info(message: string) {
    this.show({ message, type: 'info' })
  }

  warning(message: string, code?: string) {
    this.show({ message, code, type: 'warning' })
  }
}

export const toast = new ToastManager()

/**
 * Parses unknown error response shapes:
 * - { error: { code, message, details } }
 * - { detail: string | { message: string, error?: string } }
 * - Error instance
 */
export function handleApiError(err: unknown, fallback = 'An unexpected error occurred'): void {
  let message = fallback
  let code: string | undefined

  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, any>
    if (anyErr.error && typeof anyErr.error === 'object') {
      message = anyErr.error.message || message
      code = anyErr.error.code
    } else if (typeof anyErr.detail === 'string') {
      message = anyErr.detail
    } else if (anyErr.detail && typeof anyErr.detail === 'object') {
      message = anyErr.detail.message || anyErr.detail.error || message
      code = anyErr.detail.code || (anyErr.detail.error ? 'SCHEMA_ERROR' : undefined)
    } else if (anyErr.message) {
      message = anyErr.message
    }
  } else if (typeof err === 'string') {
    message = err
  }

  toast.error(message, code)
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    return toast.subscribe((updated) => setToasts(updated))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 sm:px-0 pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const isError = t.type === 'error'
        const isSuccess = t.type === 'success'
        const isWarning = t.type === 'warning'

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all animate-in slide-in-from-bottom-2 ${
              isError
                ? 'bg-white/95 border-red-200 text-[#0F3D2E]'
                : isSuccess
                ? 'bg-white/95 border-emerald-200 text-[#0F3D2E]'
                : isWarning
                ? 'bg-white/95 border-amber-200 text-[#0F3D2E]'
                : 'bg-white/95 border-[#E2EBE5] text-[#0F3D2E]'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isError && <AlertCircle className="w-4 h-4 text-red-600" />}
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {!isError && !isSuccess && !isWarning && <Info className="w-4 h-4 text-[#10B981]" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {t.code && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase bg-red-100 text-red-700">
                    {t.code}
                  </span>
                )}
                <span className="text-xs font-semibold">
                  {isError ? 'System Error' : isSuccess ? 'Success' : isWarning ? 'Notice' : 'Information'}
                </span>
              </div>
              <p className="text-xs text-[#526D61] mt-0.5 leading-relaxed break-words">{t.message}</p>
            </div>

            <button
              onClick={() => toast.dismiss(t.id)}
              className="shrink-0 text-[#82998E] hover:text-[#0F3D2E] p-1 rounded-md transition-colors"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
