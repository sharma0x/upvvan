'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// In-memory cache for client session
const memoryCache = new Map<string, CacheEntry<unknown>>()
// In-flight request pooling to deduplicate identical requests
const pendingRequests = new Map<string, Promise<unknown>>()

export interface SWROptions<T> {
  ttlMs?: number
  revalidateOnFocus?: boolean
  dedupingIntervalMs?: number
  initialData?: T
}

export interface SWRResponse<T> {
  data: T | undefined
  error: Error | null
  isLoading: boolean
  isValidating: boolean
  mutate: (newData?: T | Promise<T>, shouldRevalidate?: boolean) => Promise<T | undefined>
}

/**
 * Fetcher with built-in Stale-While-Revalidate caching and request deduplication.
 */
export async function fetchWithSWR<T>(
  key: string,
  fetcher: (signal?: AbortSignal) => Promise<T>,
  options: { ttlMs?: number; signal?: AbortSignal } = {},
): Promise<{ data: T; fromCache: boolean; isStale: boolean }> {
  const { ttlMs = 60_000, signal } = options
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined
  const now = Date.now()

  const isCacheValid = cached ? now - cached.timestamp < ttlMs : false
  const isStale = Boolean(cached && !isCacheValid)

  if (cached && isCacheValid) {
    return { data: cached.data, fromCache: true, isStale: false }
  }

  // Deduplicate inflight requests for the same key
  let requestPromise = pendingRequests.get(key) as Promise<T> | undefined
  if (!requestPromise) {
    requestPromise = fetcher(signal)
      .then((data) => {
        memoryCache.set(key, { data, timestamp: Date.now() })
        return data
      })
      .finally(() => {
        pendingRequests.delete(key)
      })
    pendingRequests.set(key, requestPromise)
  }

  if (cached) {
    // If we have stale data, don't wait for the network request in caller if SWR semantics are wanted;
    // but here we let caller know stale data is available.
    return { data: cached.data, fromCache: true, isStale }
  }

  const fresh = await requestPromise
  return { data: fresh, fromCache: false, isStale: false }
}

/**
 * React hook implementing Stale-While-Revalidate pattern.
 */
export function useSWR<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: SWROptions<T> = {},
): SWRResponse<T> {
  const { ttlMs = 60_000, revalidateOnFocus = false, initialData } = options

  const [data, setData] = useState<T | undefined>(() => {
    if (initialData !== undefined) return initialData
    if (!key) return undefined
    const cached = memoryCache.get(key) as CacheEntry<T> | undefined
    return cached?.data
  })
  const [error, setError] = useState<Error | null>(null)
  const [isValidating, setIsValidating] = useState<boolean>(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  const revalidate = useCallback(async () => {
    if (!key) return undefined

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsValidating(true)
    try {
      let req = pendingRequests.get(key) as Promise<T> | undefined
      if (!req) {
        req = fetcher(controller.signal)
          .then((fresh) => {
            memoryCache.set(key, { data: fresh, timestamp: Date.now() })
            return fresh
          })
          .finally(() => {
            pendingRequests.delete(key)
          })
        pendingRequests.set(key, req)
      }

      const freshData = await req
      setData(freshData)
      setError(null)
      return freshData
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return undefined
      }
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e)
      return undefined
    } finally {
      setIsValidating(false)
    }
  }, [key, fetcher])

  useEffect(() => {
    if (!key) return

    const cached = memoryCache.get(key) as CacheEntry<T> | undefined
    const now = Date.now()
    const isFresh = cached && now - cached.timestamp < ttlMs

    if (cached) {
      setData(cached.data)
    }

    if (!isFresh) {
      void revalidate()
    }

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [key, ttlMs, revalidate])

  // Optional focus revalidation
  useEffect(() => {
    if (!revalidateOnFocus || !key) return

    const onFocus = () => {
      void revalidate()
    }

    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [revalidateOnFocus, key, revalidate])

  const mutate = useCallback(
    async (newData?: T | Promise<T>, shouldRevalidate = true) => {
      if (!key) return undefined

      if (newData !== undefined) {
        const resolved = await newData
        memoryCache.set(key, { data: resolved, timestamp: Date.now() })
        setData(resolved)
        if (shouldRevalidate) {
          return revalidate()
        }
        return resolved
      }

      return revalidate()
    },
    [key, revalidate],
  )

  const isLoading = data === undefined && error === null && isValidating

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  }
}
