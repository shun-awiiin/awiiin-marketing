/**
 * Test Send API Route
 * POST /api/campaigns/[id]/test-send
 *
 * Sends a test email to verify campaign content before bulk sending.
 * Rate limited to 5 test sends per hour per campaign.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  validateTestSendRequest,
  sendTestEmail,
  getCampaignForTestSend,
  TestSendError,
} from '@/lib/email/test-send-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const { id: campaignId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateTestSendRequest(body);

    if (!validation.success || !validation.data) {
      return NextResponse.json(
        { success: false, error: validation.error || 'リクエストが不正です' },
        { status: 400 }
      );
    }

    // Get campaign with template
    const campaignData = await getCampaignForTestSend(campaignId, user.id);

    if (!campaignData) {
      return NextResponse.json(
        { success: false, error: 'キャンペーンが見つからないか、テスト送信できない状態です' },
        { status: 404 }
      );
    }

    // Send test email
    const result = await sendTestEmail(
      campaignData.campaign,
      campaignData.template,
      validation.data,
      user.id
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof TestSendError) {
      const statusCode = error.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 400;
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'テスト送信中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/[id]/test-send
 * Get test send rate limit status
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id: campaignId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    // Import and check rate limit
    const { checkTestSendRateLimit } = await import('@/lib/email/test-send-service');
    const rateLimit = await checkTestSendRateLimit(campaignId);

    return NextResponse.json({
      success: true,
      data: {
        allowed: rateLimit.allowed,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt?.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'レート制限の確認中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
