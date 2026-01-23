import { NextRequest, NextResponse } from 'next/server'
import { processScenarios } from '@/lib/scenarios/scenario-processor'

// POST /api/cron/scenario-processor - Process pending scenario enrollments
// This endpoint should be called by Vercel Cron or similar scheduler
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processScenarios()

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Processing failed',
      details: String(error)
    }, { status: 500 })
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'scenario-processor'
  })
}
