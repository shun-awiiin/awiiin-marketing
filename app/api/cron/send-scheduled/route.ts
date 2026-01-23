/**
 * Scheduled Send Cron API Route
 * GET /api/cron/send-scheduled
 *
 * Processes scheduled campaigns that are due for sending.
 * Called by Vercel Cron every minute.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processScheduledCampaigns,
  verifyCronSecret,
} from '@/lib/email/scheduled-send-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max for cron jobs

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (!verifyCronSecret(authHeader)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process scheduled campaigns
    const result = await processScheduledCampaigns();

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST method for manual triggering (development)
 */
export async function POST(request: NextRequest) {
  // In development, allow POST without auth
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: 'POST method only available in development' },
      { status: 405 }
    );
  }

  try {
    const result = await processScheduledCampaigns();

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
