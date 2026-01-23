import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ScenarioEnrollment,
  ScenarioStep,
  ConditionType,
  ConditionConfig,
  ConditionResult
} from '@/lib/types/l-step'

export async function executeConditionStep(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  step: ScenarioStep
): Promise<boolean> {
  const conditionType = step.condition_type
  const config = step.condition_config as ConditionConfig

  if (!conditionType) {
    // No condition type means pass through
    return true
  }

  const result = await evaluateCondition(supabase, enrollment, conditionType, config)

  if (result.met) {
    // Condition met - go to yes path
    if (step.condition_yes_step_id) {
      await supabase
        .from('scenario_enrollments')
        .update({
          current_step_id: step.condition_yes_step_id,
          next_action_at: new Date().toISOString()
        })
        .eq('id', enrollment.id)
    }
    return false // Don't use default advance
  } else if (result.timedOut) {
    // Condition timed out - go to no path
    if (step.condition_no_step_id) {
      await supabase
        .from('scenario_enrollments')
        .update({
          current_step_id: step.condition_no_step_id,
          next_action_at: new Date().toISOString()
        })
        .eq('id', enrollment.id)
    }
    return false // Don't use default advance
  }

  // Still waiting - don't advance
  return false
}

export async function evaluateCondition(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  conditionType: ConditionType,
  config: ConditionConfig
): Promise<ConditionResult> {
  switch (conditionType) {
    case 'opened':
      return evaluateOpenedCondition(supabase, enrollment, config)
    case 'clicked':
      return evaluateClickedCondition(supabase, enrollment, config)
    case 'not_opened':
      return evaluateNotOpenedCondition(supabase, enrollment, config)
    case 'not_clicked':
      return evaluateNotClickedCondition(supabase, enrollment, config)
    case 'has_tag':
      return evaluateHasTagCondition(supabase, enrollment, config)
    case 'custom_field':
      return evaluateCustomFieldCondition(supabase, enrollment, config)
    default:
      return { met: false, timedOut: false }
  }
}

async function evaluateOpenedCondition(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const { data: events } = await supabase
    .from('email_events')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('email_id', config.email_id || config.step_id)
    .eq('event_type', 'opened')
    .limit(1)

  if (events && events.length > 0) {
    return { met: true, timedOut: false }
  }

  const timedOut = checkTimeout(enrollment, config)
  return { met: false, timedOut }
}

async function evaluateClickedCondition(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const { data: events } = await supabase
    .from('email_events')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('email_id', config.email_id || config.step_id)
    .eq('event_type', 'clicked')
    .limit(1)

  if (events && events.length > 0) {
    return { met: true, timedOut: false }
  }

  const timedOut = checkTimeout(enrollment, config)
  return { met: false, timedOut }
}

async function evaluateNotOpenedCondition(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const timedOut = checkTimeout(enrollment, config)

  if (!timedOut) {
    return { met: false, timedOut: false }
  }

  const { data: events } = await supabase
    .from('email_events')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('email_id', config.email_id || config.step_id)
    .eq('event_type', 'opened')
    .limit(1)

  return { met: !events || events.length === 0, timedOut: true }
}

async function evaluateNotClickedCondition(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const timedOut = checkTimeout(enrollment, config)

  if (!timedOut) {
    return { met: false, timedOut: false }
  }

  const { data: events } = await supabase
    .from('email_events')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('email_id', config.email_id || config.step_id)
    .eq('event_type', 'clicked')
    .limit(1)

  return { met: !events || events.length === 0, timedOut: true }
}

async function evaluateHasTagCondition(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const { data: contactTags } = await supabase
    .from('contact_tags')
    .select('*')
    .eq('contact_id', enrollment.contact_id)
    .eq('tag_id', config.tag_id)
    .limit(1)

  return { met: contactTags !== null && contactTags.length > 0, timedOut: false }
}

async function evaluateCustomFieldCondition(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): Promise<ConditionResult> {
  const { data: customValue } = await supabase
    .from('contact_custom_values')
    .select('value')
    .eq('contact_id', enrollment.contact_id)
    .eq('field_id', config.field_id)
    .single()

  if (!customValue) {
    return { met: false, timedOut: false }
  }

  const value = customValue.value
  const targetValue = config.field_value

  let met = false
  switch (config.field_operator) {
    case 'equals':
      met = value === targetValue
      break
    case 'not_equals':
      met = value !== targetValue
      break
    case 'contains':
      met = value?.includes(targetValue || '') || false
      break
    case 'greater':
      met = Number(value) > Number(targetValue)
      break
    case 'less':
      met = Number(value) < Number(targetValue)
      break
  }

  return { met, timedOut: false }
}

function checkTimeout(
  enrollment: ScenarioEnrollment,
  config: ConditionConfig
): boolean {
  if (!config.timeout_value || !config.timeout_unit) {
    // Default timeout: 7 days
    const defaultTimeout = 7 * 24 * 60 * 60 * 1000
    const enrolledAt = new Date(enrollment.enrolled_at)
    const now = new Date()
    return now.getTime() - enrolledAt.getTime() >= defaultTimeout
  }

  const enrolledAt = new Date(enrollment.enrolled_at)
  const now = new Date()

  let timeoutMs = config.timeout_value
  switch (config.timeout_unit) {
    case 'minutes':
      timeoutMs *= 60 * 1000
      break
    case 'hours':
      timeoutMs *= 60 * 60 * 1000
      break
    case 'days':
      timeoutMs *= 24 * 60 * 60 * 1000
      break
  }

  return now.getTime() - enrolledAt.getTime() >= timeoutMs
}
