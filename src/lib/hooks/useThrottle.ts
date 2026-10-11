import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Throttles a value, updating at most once per `intervalMs`.
 *
 * @param value The value to throttle.
 * @param intervalMs The minimum time in milliseconds between updates (default 200ms).
 * @returns The throttled value.
 */
export function useThrottle<T>(value: T, intervalMs: number = 200): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastUpdated = useRef<number>(Date.now())

  useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastUpdated.current

    if (elapsed >= intervalMs) {
      lastUpdated.current = now
      setThrottledValue(value)
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now()
        setThrottledValue(value)
      }, intervalMs - elapsed)

      return () => clearTimeout(timer)
    }
  }, [value, intervalMs])

  return throttledValue
}

/**
 * Creates a throttled callback for scroll, resize or sensor listeners.
 *
 * @param callback The callback to throttle.
 * @param intervalMs Minimum interval between executions in milliseconds.
 * @returns A throttled callback function.
 */
export function useThrottledCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  intervalMs: number = 200,
): (...args: Args) => void {
  const callbackRef = useRef(callback)
  const lastRan = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(
    (...args: Args) => {
      const now = Date.now()
      if (now - lastRan.current >= intervalMs) {
        lastRan.current = now
        callbackRef.current(...args)
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastRan.current = Date.now()
          timeoutRef.current = null
          callbackRef.current(...args)
        }, intervalMs - (now - lastRan.current))
      }
    },
    [intervalMs],
  )
}
