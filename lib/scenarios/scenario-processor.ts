import { createClient } from '@/lib/supabase/server'
import type { ScenarioEnrollment, ScenarioStep, ProcessingResult } from '@/lib/types/l-step'
import { executeEmailStep } from './step-executors/email-step'
import { executeWaitStep } from './step-executors/wait-step'
import { executeConditionStep } from './step-executors/condition-step'
import { executeLineStep } from './step-executors/line-step'
import { executeActionStep } from './step-executors/action-step'

const BATCH_SIZE = 100
const CONCURRENCY = 10
const LOCK_KEY = 12345

interface EnrollmentWithDetails extends ScenarioEnrollment {
  scenario: { id: string; status: string }
  current_step: ScenarioStep | null
}

export async function processScenarios(): Promise<ProcessingResult> {
  const supabase = await createClient()

  // Acquire advisory lock to prevent concurrent execution
  const { data: lockAcquired } = await supabase.rpc('acquire_advisory_lock', {
    lock_key: LOCK_KEY
  })

  if (!lockAcquired) {
    return { processed: 0, errors: [], skipped: true }
  }

  try {
    // Fetch enrollments ready for processing
    const { data: enrollments, error } = await supabase
      .from('scenario_enrollments')
      .select(`
        *,
        scenario:scenarios!inner(id, status),
        current_step:scenario_steps(*)
      `)
      .eq('status', 'active')
      .eq('scenarios.status', 'active')
      .lte('next_action_at', new Date().toISOString())
      .limit(BATCH_SIZE)

    if (error || !enrollments) {
      await logError(supabase, null, null, `Failed to fetch enrollments: ${error?.message}`)
      return { processed: 0, errors: [error?.message || 'Unknown error'] }
    }

    const results = await processInBatches(
      supabase,
      enrollments as EnrollmentWithDetails[],
      CONCURRENCY
    )

    return results
  } finally {
    // Release lock
    await supabase.rpc('release_advisory_lock', { lock_key: LOCK_KEY })
  }
}

async function processInBatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollments: EnrollmentWithDetails[],
  concurrency: number
): Promise<ProcessingResult> {
  const results: ProcessingResult = { processed: 0, errors: [] }

  for (let i = 0; i < enrollments.length; i += concurrency) {
    const batch = enrollments.slice(i, i + concurrency)
    const promises = batch.map(async (enrollment) => {
      try {
        await processEnrollment(supabase, enrollment)
        results.processed++
      } catch (err) {
        const errorMsg = `Enrollment ${enrollment.id}: ${err}`
        results.errors.push(errorMsg)
        await logError(supabase, enrollment.scenario_id, enrollment.id, errorMsg)
      }
    })
    await Promise.all(promises)
  }

  return results
}

async function processEnrollment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollment: EnrollmentWithDetails
): Promise<void> {
  const step = enrollment.current_step

  if (!step) {
    // No current step means completed
    await markEnrollmentCompleted(supabase, enrollment.id)
    return
  }

  // Execute step based on type
  let shouldAdvance = true

  switch (step.step_type) {
    case 'email':
      await executeEmailStep(supabase, enrollment, step)
      break
    case 'wait':
      await executeWaitStep(supabase, enrollment, step)
      break
    case 'condition':
      shouldAdvance = await executeConditionStep(supabase, enrollment, step)
      break
    case 'line':
      await executeLineStep(supabase, enrollment, step)
      break
    case 'action':
      await executeActionStep(supabase, enrollment, step)
      break
    default:
      await logError(
        supabase,
        enrollment.scenario_id,
        enrollment.id,
        `Unknown step type: ${step.step_type}`
      )
  }

  // Move to next step if applicable
  if (shouldAdvance) {
    await moveToNextStep(supabase, enrollment, step)
  }

  // Log progress
  await logProgress(supabase, enrollment.scenario_id, enrollment.id, step.id, step.step_type)
}

async function moveToNextStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollment: ScenarioEnrollment,
  currentStep: ScenarioStep
): Promise<void> {
  const nextStepId = currentStep.next_step_id

  if (!nextStepId) {
    // No next step means scenario completed
    await markEnrollmentCompleted(supabase, enrollment.id)
    return
  }

  // Get next step to calculate next_action_at
  const { data: nextStep } = await supabase
    .from('scenario_steps')
    .select('*')
    .eq('id', nextStepId)
    .single()

  let nextActionAt = new Date()

  // If next step is wait, calculate delay
  if (nextStep?.step_type === 'wait') {
    const config = nextStep.config as { wait_value?: number; wait_unit?: string }
    const value = config.wait_value || 1
    const unit = config.wait_unit || 'days'

    switch (unit) {
      case 'minutes':
        nextActionAt.setMinutes(nextActionAt.getMinutes() + value)
        break
      case 'hours':
        nextActionAt.setHours(nextActionAt.getHours() + value)
        break
      case 'days':
        nextActionAt.setDate(nextActionAt.getDate() + value)
        break
    }
  }

  await supabase
    .from('scenario_enrollments')
    .update({
      current_step_id: nextStepId,
      next_action_at: nextActionAt.toISOString()
    })
    .eq('id', enrollment.id)
}

async function markEnrollmentCompleted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollmentId: string
): Promise<void> {
  await supabase
    .from('scenario_enrollments')
    .update({
      status: 'completed',
      current_step_id: null,
      next_action_at: null,
      completed_at: new Date().toISOString()
    })
    .eq('id', enrollmentId)
}

async function logProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scenarioId: string,
  enrollmentId: string,
  stepId: string,
  stepType: string
): Promise<void> {
  await supabase.from('scenario_logs').insert({
    scenario_id: scenarioId,
    enrollment_id: enrollmentId,
    step_id: stepId,
    level: 'info',
    message: `Step executed: ${stepType}`,
    metadata: { step_type: stepType }
  })
}

async function logError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scenarioId: string | null,
  enrollmentId: string | null,
  message: string
): Promise<void> {
  await supabase.from('scenario_logs').insert({
    scenario_id: scenarioId,
    enrollment_id: enrollmentId,
    level: 'error',
    message
  })
}

// Export for use in condition step
export { moveToNextStep, markEnrollmentCompleted }
