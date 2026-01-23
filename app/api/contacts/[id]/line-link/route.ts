import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLineLinkSchema } from '@/lib/validation/l-step'
import { createLinkToken } from '@/lib/line/line-linker'

// GET /api/contacts/[id]/line-link - Get contact's LINE links
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    // Verify contact belongs to user
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ success: false, error: 'コンタクトが見つかりません' }, { status: 404 })
    }

    // Get LINE links with account info
    const { data: links, error } = await supabase
      .from('contact_line_links')
      .select(`
        id,
        line_user_id,
        display_name,
        picture_url,
        status,
        linked_at,
        line_account:line_accounts(
          id,
          channel_id,
          bot_basic_id,
          display_name
        )
      `)
      .eq('contact_id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: links })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/contacts/[id]/line-link - Generate link token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createLineLinkSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { line_account_id } = validation.data

    // Verify contact belongs to user
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ success: false, error: 'コンタクトが見つかりません' }, { status: 404 })
    }

    // Verify LINE account belongs to user
    const { data: lineAccount } = await supabase
      .from('line_accounts')
      .select('id')
      .eq('id', line_account_id)
      .eq('user_id', user.id)
      .single()

    if (!lineAccount) {
      return NextResponse.json({ success: false, error: 'LINEアカウントが見つかりません' }, { status: 404 })
    }

    // Check if already linked
    const { data: existingLink } = await supabase
      .from('contact_line_links')
      .select('id')
      .eq('contact_id', id)
      .eq('line_account_id', line_account_id)
      .single()

    if (existingLink) {
      return NextResponse.json({
        success: false,
        error: 'このコンタクトは既にこのLINEアカウントと紐付けられています'
      }, { status: 400 })
    }

    // Create link token
    const { token, linkUrl } = await createLinkToken(supabase, id, line_account_id)

    return NextResponse.json({
      success: true,
      data: { token, linkUrl }
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/contacts/[id]/line-link - Remove LINE link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const url = new URL(request.url)
    const lineAccountId = url.searchParams.get('line_account_id')

    // Verify contact belongs to user
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!contact) {
      return NextResponse.json({ success: false, error: 'コンタクトが見つかりません' }, { status: 404 })
    }

    // Delete link(s)
    let query = supabase
      .from('contact_line_links')
      .delete()
      .eq('contact_id', id)

    if (lineAccountId) {
      query = query.eq('line_account_id', lineAccountId)
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
