import React from 'react'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  width?: string | number
  height?: string | number
}

/**
 * Low-level geometric Skeleton primitive.
 * Emits a subtle shimmer matching surrounding layout geometry without causing layout shifts.
 */
export function Skeleton({ className = '', width, height, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface-raised relative overflow-hidden rounded-sm before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  )
}

/**
 * Structural Skeleton loader for Cart, matching the exact height, line count, and item geometry.
 * Prevents Cumulative Layout Shift (CLS) when reading local session draft.
 */
export function CartSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="w-full">
      <span className="sr-only">Loading cart items…</span>
      <ul className="gap-sm m-0 flex list-none flex-col p-0">
        {[1, 2].map((i) => (
          <li key={i} className="border-border p-base rounded-sm border">
            <div className="gap-base flex flex-wrap items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="border-border mt-sm gap-sm pt-sm flex items-center border-t">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-11 w-28" />
            </div>
          </li>
        ))}
      </ul>

      <div className="border-border mt-lg p-base rounded-sm border">
        <Skeleton className="mb-sm h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 w-20" />
        </div>
      </div>

      <div className="mt-lg flex justify-end">
        <Skeleton className="h-12 w-48" />
      </div>
    </div>
  )
}

/**
 * Structural Skeleton loader for Checkout, matching inputs, address fields, and order totals.
 */
export function CheckoutSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="w-full">
      <span className="sr-only">Loading checkout…</span>
      <ul className="gap-sm m-0 flex list-none flex-col p-0">
        <li className="border-border p-base flex justify-between rounded-sm border">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-20" />
        </li>
      </ul>

      <div className="border-border mt-base gap-xs pt-base flex flex-col border-t">
        <div className="flex justify-between py-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between py-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="border-border flex justify-between border-t pt-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>

      <div className="mt-lg space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
        </div>
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  )
}
