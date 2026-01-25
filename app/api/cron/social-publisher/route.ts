/**
 * Social Publisher Cron Endpoint
 * Processes scheduled posts and retries failed posts
 *
 * Should be called every minute by a cron job
 * Configure in vercel.json or cron service
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  processScheduledPosts,
  processRetryPosts,
  refreshExpiringTokens,
} from '@/lib/social/scheduled-post-processor'

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    // Allow in development without secret
    return process.env.NODE_ENV === 'development'
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * GET /api/cron/social-publisher
 * Process scheduled social media posts
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const startTime = Date.now()

    // Process scheduled posts
    const scheduledResult = await processScheduledPosts()

    // Process retry posts
    const retryResult = await processRetryPosts()

    // Refresh expiring tokens
    const tokenResult = await refreshExpiringTokens()

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        scheduled: {
          processed: scheduledResult.processed,
          successful: scheduledResult.successful,
          failed: scheduledResult.failed,
        },
        retry: {
          processed: retryResult.processed,
          successful: retryResult.successful,
          failed: retryResult.failed,
        },
        tokens: {
          refreshed: tokenResult.refreshed,
          failed: tokenResult.failed,
        },
        duration: `${duration}ms`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron job failed',
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}
