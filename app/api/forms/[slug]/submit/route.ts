import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SubmitFormSchema } from '@/lib/types/forms'
import type { FormField, FormSettings } from '@/lib/types/forms'
import { sendEmail } from '@/lib/email/email-sender'

type RouteParams = { params: Promise<{ slug: string }> }

function validateRequiredFields(
  fields: FormField[],
  data: Record<string, unknown>
): string[] {
  const errors: string[] = []
  for (const field of fields) {
    if (field.required && !data[field.name]) {
      errors.push(`${field.label}は必須です`)
    }
  }
  return errors
}

function extractEmail(data: Record<string, unknown>): string | null {
  const emailKeys = ['email', 'mail', 'メール', 'メールアドレス', 'e-mail']
  for (const key of emailKeys) {
    const value = data[key]
    if (typeof value === 'string' && value.includes('@')) {
      return value
    }
  }
  return null
}

async function sendAutoReply(
  settings: FormSettings,
  recipientEmail: string,
  formOwnerEmail: string
): Promise<void> {
  if (!settings.autoReplyEnabled || !recipientEmail) return

  const body = settings.autoReplyBody || settings.successMessage

  await sendEmail({
    to: recipientEmail,
    subject: settings.autoReplySubject,
    text: body,
    fromName: 'MailFlow',
    fromEmail: formOwnerEmail,
  })
}

async function applyTags(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  contactId: string,
  tagIds: string[]
): Promise<void> {
  if (tagIds.length === 0 || !contactId) return

  const rows = tagIds.map((tagId) => ({
    contact_id: contactId,
    tag_id: tagId,
  }))

  await supabase
    .from('contact_tags')
    .upsert(rows, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true })
}

async function enrollInScenario(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  contactId: string,
  scenarioId: string
): Promise<void> {
  if (!contactId || !scenarioId) return

  await supabase.from('scenario_enrollments').upsert(
    {
      scenario_id: scenarioId,
      contact_id: contactId,
      status: 'active',
      current_step_index: 0,
      next_action_at: new Date().toISOString(),
    },
    { onConflict: 'scenario_id,contact_id', ignoreDuplicates: true }
  )
}

async function recordActivity(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  contactId: string,
  userId: string,
  formId: string,
  submissionId: string
): Promise<void> {
  if (!contactId) return

  await supabase.from('contact_activities').insert({
    contact_id: contactId,
    user_id: userId,
    activity_type: 'form_submit',
    title: 'フォーム送信',
    description: 'フォームからの送信がありました',
    reference_type: 'form_submission',
    reference_id: submissionId,
    occurred_at: new Date().toISOString(),
  })
}

// POST /api/forms/:slug/submit - Public form submission
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const supabase = await createServiceClient()

    // Fetch active form by slug
    const { data: form, error: formError } = await supabase
      .from('standalone_forms')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { error: 'フォームが見つからないか、現在受付を停止しています' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = SubmitFormSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { data: formData, utm_params } = validation.data
    const fields = form.fields as FormField[]
    const settings = form.settings as FormSettings

    // Validate required fields
    const fieldErrors = validateRequiredFields(fields, formData)
    if (fieldErrors.length > 0) {
      return NextResponse.json(
        { error: '必須項目が入力されていません', details: fieldErrors },
        { status: 400 }
      )
    }

    // Insert submission
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent') || null

    const { data: submission, error: submitError } = await supabase
      .from('standalone_form_submissions')
      .insert({
        form_id: form.id,
        user_id: form.user_id,
        form_data: formData,
        utm_params: utm_params || {},
        ip_address: ip,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (submitError) {
      return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
    }

    // Post-submission processing (fire-and-forget style, but awaited for correctness)
    const contactId = submission.contact_id as string | null
    const recipientEmail = extractEmail(formData)

    // Fetch form owner email for auto-reply from address
    const { data: ownerUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', form.user_id)
      .single()

    const ownerEmail = ownerUser?.email || 'noreply@example.com'

    const postProcessing: Promise<void>[] = []

    if (recipientEmail) {
      postProcessing.push(sendAutoReply(settings, recipientEmail, ownerEmail))
    }

    if (contactId && settings.tagIds.length > 0) {
      postProcessing.push(applyTags(supabase, contactId, settings.tagIds))
    }

    if (contactId && settings.scenarioId) {
      postProcessing.push(enrollInScenario(supabase, contactId, settings.scenarioId))
    }

    if (contactId) {
      postProcessing.push(
        recordActivity(supabase, contactId, form.user_id, form.id, submission.id)
      )
    }

    await Promise.allSettled(postProcessing)

    return NextResponse.json({
      data: {
        success: true,
        message: settings.successMessage,
        redirectUrl: settings.redirectUrl,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
