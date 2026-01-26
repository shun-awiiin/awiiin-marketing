import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const addContactsSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1, '少なくとも1件のコンタクトを選択してください')
})

const removeContactsSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1, '少なくとも1件のコンタクトを選択してください')
})

// GET /api/lists/:id/contacts - Get contacts in list
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')

    // Verify list ownership
    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (listError || !list) {
      return NextResponse.json({ success: false, error: 'リストが見つかりません' }, { status: 404 })
    }

    // Get total count
    const { count: total } = await supabase
      .from('list_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', id)

    // Get paginated contacts
    const start = (page - 1) * perPage
    const { data: listContacts, error } = await supabase
      .from('list_contacts')
      .select('contact_id, added_at')
      .eq('list_id', id)
      .order('added_at', { ascending: false })
      .range(start, start + perPage - 1)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!listContacts || listContacts.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { total: total || 0, page, per_page: perPage }
      })
    }

    // Get contact details
    const contactIds = listContacts.map(lc => lc.contact_id)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email, first_name, company, status, created_at')
      .in('id', contactIds)

    return NextResponse.json({
      success: true,
      data: contacts || [],
      meta: { total: total || 0, page, per_page: perPage }
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lists/:id/contacts - Add contacts to list
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
    const validation = addContactsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    // Verify list ownership
    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (listError || !list) {
      return NextResponse.json({ success: false, error: 'リストが見つかりません' }, { status: 404 })
    }

    // Verify contacts belong to user
    const { data: userContacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)
      .in('id', validation.data.contact_ids)

    const validContactIds = userContacts?.map(c => c.id) || []

    if (validContactIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '有効なコンタクトがありません'
      }, { status: 400 })
    }

    // Insert contacts
    const insertData = validContactIds.map(contactId => ({
      list_id: id,
      contact_id: contactId
    }))

    const { error } = await supabase
      .from('list_contacts')
      .upsert(insertData, { onConflict: 'list_id,contact_id' })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { added: validContactIds.length }
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lists/:id/contacts - Remove contacts from list
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

    const body = await request.json()
    const validation = removeContactsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    // Verify list ownership
    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (listError || !list) {
      return NextResponse.json({ success: false, error: 'リストが見つかりません' }, { status: 404 })
    }

    const { error } = await supabase
      .from('list_contacts')
      .delete()
      .eq('list_id', id)
      .in('contact_id', validation.data.contact_ids)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { removed: validation.data.contact_ids.length }
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
