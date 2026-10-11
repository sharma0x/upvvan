'use client'

import { useEffect, useState, useMemo } from 'react'
import { useThrottledCallback } from './useThrottle'

export interface VirtualScrollOptions {
  /** Total number of items in the list */
  count: number
  /** Estimated or fixed height of each row in pixels */
  estimateItemHeight: number
  /** Number of items to render above and below the visible viewport */
  overscan?: number
  /** Number of columns for grid layouts (default 1) */
  columns?: number
}

export interface VirtualRow {
  index: number
  offsetTop: number
  height: number
}

/**
 * Window-based or container-based virtual scroll hook for feeds, tables, and grids exceeding 50 items.
 * Renders only visible rows to ensure constant 60fps frame rates and minimal DOM memory footprint.
 */
export function useVirtualScroll({
  count,
  estimateItemHeight,
  overscan = 3,
  columns = 1,
}: VirtualScrollOptions) {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(800)

  // Number of rows (for multi-column grids)
  const rowCount = Math.ceil(count / columns)

  const handleScroll = useThrottledCallback(() => {
    if (typeof window !== 'undefined') {
      setScrollTop(window.scrollY || document.documentElement.scrollTop)
      setViewportHeight(window.innerHeight)
    }
  }, 16) // ~60fps throttle

  useEffect(() => {
    if (typeof window === 'undefined') return

    setViewportHeight(window.innerHeight)
    setScrollTop(window.scrollY || document.documentElement.scrollTop)

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [handleScroll])

  const totalHeight = rowCount * estimateItemHeight

  const { startRow, endRow, startIndex, endIndex } = useMemo(() => {
    const rawStartRow = Math.floor(scrollTop / estimateItemHeight)
    const rawEndRow = Math.ceil((scrollTop + viewportHeight) / estimateItemHeight)

    const boundedStartRow = Math.max(0, rawStartRow - overscan)
    const boundedEndRow = Math.min(rowCount, rawEndRow + overscan)

    const boundedStartIndex = boundedStartRow * columns
    const boundedEndIndex = Math.min(count, boundedEndRow * columns)

    return {
      startRow: boundedStartRow,
      endRow: boundedEndRow,
      startIndex: boundedStartIndex,
      endIndex: boundedEndIndex,
    }
  }, [scrollTop, viewportHeight, estimateItemHeight, overscan, rowCount, count, columns])

  const topPadding = startRow * estimateItemHeight
  const bottomPadding = Math.max(0, (rowCount - endRow) * estimateItemHeight)

  const isVirtualizing = count > 50

  return {
    startIndex: isVirtualizing ? startIndex : 0,
    endIndex: isVirtualizing ? endIndex : count,
    startRow: isVirtualizing ? startRow : 0,
    endRow: isVirtualizing ? endRow : rowCount,
    topPadding: isVirtualizing ? topPadding : 0,
    bottomPadding: isVirtualizing ? bottomPadding : 0,
    totalHeight,
    isVirtualizing,
  }
}
