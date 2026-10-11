import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Debounces a value by the specified delay in milliseconds.
 *
 * @param value The value to debounce.
 * @param delayMs The debounce delay in milliseconds (defaults to 300ms).
 * @returns The debounced value.
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delayMs])

  return debouncedValue
}

/**
 * Creates a debounced version of a callback function.
 * Cancels pending executions on component unmount or subsequent calls.
 *
 * @param callback The function to debounce.
 * @param delayMs The debounce delay in milliseconds (defaults to 300ms).
 * @returns A stable debounced callback and a cancel method.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number = 300,
): ((...args: Args) => void) & { cancel: () => void } {
  const callbackRef = useRef(callback)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return cancel
  }, [cancel])

  const debounced = useCallback(
    (...args: Args) => {
      cancel()
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args)
        timerRef.current = null
      }, delayMs)
    },
    [delayMs, cancel],
  ) as ((...args: Args) => void) & { cancel: () => void }

  debounced.cancel = cancel

  return debounced
}
