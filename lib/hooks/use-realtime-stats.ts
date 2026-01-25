/**
 * useRealtimeStats Hook
 * Subscribes to campaign statistics updates using Supabase Realtime
 */

"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CampaignStats, RealtimeStats } from '@/lib/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeStatsOptions {
  enabled?: boolean;
  refreshInterval?: number; // Fallback polling interval in ms
}

interface UseRealtimeStatsReturn {
  stats: RealtimeStats | null;
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Default empty stats
 */
const defaultStats: CampaignStats = {
  total: 0,
  queued: 0,
  sending: 0,
  sent: 0,
  delivered: 0,
  bounced: 0,
  complained: 0,
  failed: 0,
  bounce_rate: 0,
  complaint_rate: 0,
};

/**
 * Debounce function for batching rapid updates
 */
function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

export function useRealtimeStats(
  campaignId: string,
  options: UseRealtimeStatsOptions = {}
): UseRealtimeStatsReturn {
  const { enabled = true, refreshInterval = 30000 } = options;

  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  /**
   * Fetch stats from API
   */
  const fetchStats = useCallback(async () => {
    try {
      const { data, error: statsError } = await supabase.rpc('get_campaign_stats', {
        p_campaign_id: campaignId,
      });

      if (statsError) {
        throw new Error(statsError.message);
      }

      const statsData = data?.[0] || defaultStats;

      setStats((prev) => ({
        ...statsData,
        last_updated: prev?.last_updated ?? null,
        is_connected: isConnected,
      }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch stats'));
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, supabase, isConnected]);

  /**
   * Debounced refetch for handling rapid updates
   */
  const debouncedFetch = useDebouncedCallback(fetchStats, 500);

  /**
   * Handle realtime message changes
   */
  const handleMessageChange = useCallback(() => {
    // Debounce to avoid too many refetches during bulk operations
    debouncedFetch();
  }, [debouncedFetch]);

  /**
   * Setup realtime subscription
   */
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchStats();

    // Subscribe to message changes for this campaign
    const channel = supabase
      .channel(`campaign-stats:${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `campaign_id=eq.${campaignId}`,
        },
        handleMessageChange
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          setStats((prev) =>
            prev ? { ...prev, is_connected: true } : null
          );
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [campaignId, enabled, supabase, fetchStats, handleMessageChange]);

  /**
   * Fallback polling when not connected
   */
  useEffect(() => {
    if (!enabled || isConnected) return;

    const interval = setInterval(() => {
      fetchStats();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [enabled, isConnected, refreshInterval, fetchStats]);

  return {
    stats,
    isConnected,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
