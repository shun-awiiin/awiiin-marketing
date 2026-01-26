'use client'

import { useState, useEffect, useRef } from 'react'
import type { SegmentRules } from '@/lib/types/l-step'

interface UseSegmentPreviewResult {
  count: number | null
  isLoading: boolean
  error: string | null
}

export function useSegmentPreview(
  rules: SegmentRules,
  delay: number = 500
): UseSegmentPreviewResult {
  const [count, setCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const fetchPreview = async () => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/segments/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules }),
          signal: abortControllerRef.current.signal
        })

        const result = await response.json()

        if (result.success) {
          setCount(result.data.count)
        } else {
          setError(result.error)
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError('プレビューの取得に失敗しました')
        }
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchPreview, delay)

    return () => {
      clearTimeout(timeoutId)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [rules, delay])

  return { count, isLoading, error }
}
