'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((props: { error: Error; reset: () => void }) => ReactNode)
  onReset?: () => void
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  label?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Production-grade Error Boundary.
 * Catches rendering throws in child components and displays a structured,
 * accessible fallback UI with a "Try again" / "Retry" action.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    } else {
      console.error(
        `[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}] caught error:`,
        error,
        errorInfo,
      )
    }
  }

  public reset = (): void => {
    if (this.props.onReset) {
      this.props.onReset()
    }
    this.setState({ hasError: false, error: null })
  }

  public override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({ error: this.state.error, reset: this.reset })
      }

      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <section
          role="alert"
          aria-live="assertive"
          className="border-danger/30 bg-surface-raised my-base p-lg flex flex-col items-start rounded-md border"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-danger text-lg font-bold">
              ⚠
            </span>
            <h3 className="text-ink m-0 text-base font-semibold">
              {this.props.label
                ? `Unable to display ${this.props.label}`
                : 'Something went wrong with this section'}
            </h3>
          </div>
          <p className="text-ink-muted mt-xs mb-base text-sm">
            We encountered a temporary display issue. Your saved data has not been lost.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="border-border bg-surface hover:bg-surface-card focus-visible:ring-primary min-h-[44px] cursor-pointer rounded-sm border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            Try again
          </button>
        </section>
      )
    }

    return this.props.children
  }
}
