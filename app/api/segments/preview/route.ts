import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { segmentRulesSchema } from '@/lib/validation/l-step'
import { countSegmentContacts } from '@/lib/segments/segment-evaluator'

// POST /api/segments/preview - Preview segment contact count
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const validation = segmentRulesSchema.safeParse(body.rules)

    if (!validation.success) {
      console.error('Segment preview validation error:', validation.error.errors)
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    // Debug: Check contact_tags table directly
    const tagCondition = validation.data.conditions.find(c => c.type === 'tag')
    let debugInfo: Record<string, unknown> = {
      version: 'v3-pagination',  // Version marker to confirm deployment
      userId: user.id
    }
    
    if (tagCondition) {
      const tagId = tagCondition.value as string
      
      // Count total contacts for user
      const { count: totalContacts, error: contactError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      
      // Count contact_tags for this tag (via RLS)
      const { data: tagEntries, count: tagCount, error: tagError } = await supabase
        .from('contact_tags')
        .select('contact_id', { count: 'exact' })
        .eq('tag_id', tagId)
      
      debugInfo = {
        ...debugInfo,
        tagId,
        totalContacts,
        contactError: contactError?.message,
        tagEntriesCount: tagCount,
        tagError: tagError?.message,
        sampleTagEntries: tagEntries?.slice(0, 5)
      }
    }

    console.log('Evaluating segment preview:', JSON.stringify(validation.data))
    const count = await countSegmentContacts(supabase, user.id, validation.data)
    console.log('Segment preview count:', count)

    return NextResponse.json({
      success: true,
      data: { count },
      debug: debugInfo  // Temporary debug info
    })
  } catch (error) {
    console.error('Segment preview error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
