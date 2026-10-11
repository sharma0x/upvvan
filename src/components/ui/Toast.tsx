'use client'

import React, { useEffect, useState } from 'react'

export interface ToastMessage {
  id: string
  title?: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

type ToastListener = (toasts: ToastMessage[]) => void

class ToastStore {
  private toasts: ToastMessage[] = []
  private listeners: Set<ToastListener> = new Set()

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener)
    listener(this.toasts)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public show(message: string, type: ToastMessage['type'] = 'info', title?: string): string {
    const id = Math.random().toString(36).substring(2, 9)
    const toast: ToastMessage = { id, message, type, title }
    this.toasts = [...this.toasts, toast]
    this.notify()

    setTimeout(() => {
      this.dismiss(id)
    }, 4500)

    return id
  }

  public dismiss(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id)
    this.notify()
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.toasts))
  }
}

export const toastStore = new ToastStore()

export const toast = {
  info: (msg: string, title?: string) => toastStore.show(msg, 'info', title),
  success: (msg: string, title?: string) => toastStore.show(msg, 'success', title),
  error: (msg: string, title?: string) => toastStore.show(msg, 'error', title),
  warning: (msg: string, title?: string) => toastStore.show(msg, 'warning', title),
  dismiss: (id: string) => toastStore.dismiss(id),
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    return toastStore.subscribe(setToasts)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={`shadow-md flex items-start gap-3 rounded-md p-3.5 text-sm border ${
            t.type === 'error'
              ? 'border-danger/40 bg-surface-raised text-danger'
              : t.type === 'success'
              ? 'border-success/40 bg-surface-raised text-success'
              : t.type === 'warning'
              ? 'border-warning/40 bg-surface-raised text-ochre'
              : 'border-border bg-surface-raised text-ink'
          }`}
        >
          <div className="flex-1">
            {t.title && <div className="font-semibold">{t.title}</div>}
            <div>{t.message}</div>
          </div>
          <button
            type="button"
            onClick={() => toastStore.dismiss(t.id)}
            aria-label="Close notification"
            className="text-ink-muted hover:text-ink cursor-pointer p-0.5 text-xs"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
