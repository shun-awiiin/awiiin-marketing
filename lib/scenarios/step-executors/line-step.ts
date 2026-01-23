import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScenarioEnrollment, ScenarioStep, StepConfig } from '@/lib/types/l-step'

export async function executeLineStep(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  step: ScenarioStep
): Promise<void> {
  // Get contact's LINE link
  const { data: lineLink } = await supabase
    .from('contact_line_links')
    .select(`
      *,
      line_account:line_accounts(*)
    `)
    .eq('contact_id', enrollment.contact_id)
    .eq('status', 'active')
    .single()

  if (!lineLink || !lineLink.line_account) {
    // Contact not linked to LINE - skip silently
    return
  }

  const config = step.config as StepConfig
  const account = lineLink.line_account

  try {
    const { LineClient, buildTextMessage, buildFlexMessage } = await import('@/lib/line/line-client')
    const client = new LineClient(account.access_token, account.channel_secret)

    // Build message based on type
    const messages = []

    switch (config.line_message_type) {
      case 'text':
        if (config.line_content?.text) {
          messages.push(buildTextMessage(config.line_content.text))
        }
        break
      case 'flex':
        if (config.line_content?.contents) {
          messages.push(buildFlexMessage(
            config.line_content.altText || 'メッセージ',
            config.line_content.contents
          ))
        }
        break
      default:
        if (config.line_content?.text) {
          messages.push(buildTextMessage(config.line_content.text))
        }
    }

    if (messages.length > 0) {
      await client.pushMessage(lineLink.line_user_id, messages)

      // Log the message
      await supabase.from('line_messages').insert({
        line_account_id: account.id,
        contact_id: enrollment.contact_id,
        line_user_id: lineLink.line_user_id,
        message_type: 'sent',
        content: messages[0],
        status: 'sent',
        sent_at: new Date().toISOString()
      })
    }
  } catch (error) {
    // Log error but don't fail the step
    await supabase.from('line_messages').insert({
      line_account_id: account.id,
      contact_id: enrollment.contact_id,
      line_user_id: lineLink.line_user_id,
      message_type: 'sent',
      content: config.line_content || {},
      status: 'failed',
      error_message: String(error)
    })
  }
}
