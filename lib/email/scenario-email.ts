import { createClient } from '@/lib/supabase/server'

interface ScenarioEmailOptions {
  to: string
  subject: string
  html: string
  fromName?: string
  fromEmail?: string
  contactId: string
  scenarioId: string
  stepId: string
}

export async function sendScenarioEmail(options: ScenarioEmailOptions): Promise<void> {
  const {
    to,
    subject,
    html,
    fromName = 'Awiiin',
    fromEmail = 'info@m.awiiin.com',
    contactId,
    scenarioId,
    stepId
  } = options

  const supabase = await createClient()
  const emailId = `scenario_${scenarioId}_step_${stepId}_${Date.now()}`

  try {
    // Try Resend first
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)

      const { error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html
      })

      if (error) {
        throw new Error(error.message)
      }
    } else if (process.env.SENDGRID_API_KEY) {
      // Fallback to SendGrid
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: fromName },
          subject,
          content: [{ type: 'text/html', value: html }]
        })
      })

      if (!response.ok) {
        throw new Error(`SendGrid error: ${response.statusText}`)
      }
    } else {
      // No email provider configured - just log
      await supabase.from('scenario_logs').insert({
        scenario_id: scenarioId,
        level: 'warn',
        message: 'No email provider configured, email not sent',
        metadata: { to, subject }
      })
      return
    }

    // Record sent event
    await supabase.from('email_events').insert({
      contact_id: contactId,
      email_id: emailId,
      event_type: 'sent',
      metadata: {
        scenario_id: scenarioId,
        step_id: stepId,
        subject
      }
    })
  } catch (error) {
    // Record error
    await supabase.from('email_events').insert({
      contact_id: contactId,
      email_id: emailId,
      event_type: 'failed',
      metadata: {
        scenario_id: scenarioId,
        step_id: stepId,
        error: String(error)
      }
    })

    throw error
  }
}
