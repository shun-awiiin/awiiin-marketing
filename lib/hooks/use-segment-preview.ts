'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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

  // Serialize rules to detect actual changes (not just reference changes)
  const rulesKey = useMemo(() => JSON.stringify(rules), [rules])

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
        console.log('Fetching segment preview with rules:', rulesKey)
        const response = await fetch('/api/segments/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules }),
          signal: abortControllerRef.current.signal
        })

        const result = await response.json()
        console.log('Preview result:', result)

        if (result.success) {
          setCount(result.data.count)
        } else {
          console.error('Preview error:', result.error)
          setError(result.error)
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Preview fetch error:', err)
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
  }, [rulesKey, delay, rules])

  return { count, isLoading, error }
}
