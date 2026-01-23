import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScenarioEnrollment, ScenarioStep } from '@/lib/types/l-step'

export async function executeWaitStep(
  _supabase: SupabaseClient,
  _enrollment: ScenarioEnrollment,
  _step: ScenarioStep
): Promise<void> {
  // Wait steps don't execute anything
  // The actual waiting is handled by next_action_at calculation in moveToNextStep
  // This function exists for consistency and potential future enhancements
  return
}
