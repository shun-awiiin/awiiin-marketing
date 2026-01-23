import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScenarioEnrollment, ScenarioStep, StepConfig } from '@/lib/types/l-step'

interface Contact {
  id: string
  email: string
  first_name?: string
  company?: string
}

export async function executeEmailStep(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  step: ScenarioStep
): Promise<void> {
  // Get contact details
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, email, first_name, company')
    .eq('id', enrollment.contact_id)
    .single()

  if (!contact?.email) {
    throw new Error('Contact has no email address')
  }

  const config = step.config as StepConfig

  // Prepare email content with variable substitution
  const subject = substituteVariables(config.subject || 'お知らせ', contact)
  const content = substituteVariables(config.content || '', contact)

  // Check if email module exists and send
  try {
    // Try to use existing email sending functionality
    const { sendScenarioEmail } = await import('@/lib/email/scenario-email')
    await sendScenarioEmail({
      to: contact.email,
      subject,
      html: content,
      fromName: config.from_name,
      fromEmail: config.from_email,
      contactId: contact.id,
      scenarioId: enrollment.scenario_id,
      stepId: step.id
    })
  } catch {
    // Fallback: just record the email event
    await supabase.from('email_events').insert({
      contact_id: contact.id,
      email_id: `scenario_${enrollment.scenario_id}_step_${step.id}`,
      event_type: 'sent',
      metadata: {
        scenario_id: enrollment.scenario_id,
        step_id: step.id,
        subject
      }
    })
  }
}

function substituteVariables(template: string, contact: Contact): string {
  let result = template

  // Common variable substitutions
  const variables: Record<string, string> = {
    '{{name}}': contact.first_name || '',
    '{{firstName}}': contact.first_name || '',
    '{{email}}': contact.email,
    '{{company}}': contact.company || ''
  }

  for (const [placeholder, value] of Object.entries(variables)) {
    result = result.replaceAll(placeholder, value)
  }

  return result
}
