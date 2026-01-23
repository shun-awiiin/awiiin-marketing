import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScenarioEnrollment, ScenarioStep, StepConfig } from '@/lib/types/l-step'

export async function executeActionStep(
  supabase: SupabaseClient,
  enrollment: ScenarioEnrollment,
  step: ScenarioStep
): Promise<void> {
  const config = step.config as StepConfig
  const actionType = config.action_type
  const actionConfig = config.action_config as Record<string, string> | undefined

  if (!actionType || !actionConfig) {
    return
  }

  switch (actionType) {
    case 'add_tag':
      await addTagToContact(supabase, enrollment.contact_id, actionConfig.tag_id)
      break
    case 'remove_tag':
      await removeTagFromContact(supabase, enrollment.contact_id, actionConfig.tag_id)
      break
    case 'update_field':
      await updateCustomField(
        supabase,
        enrollment.contact_id,
        actionConfig.field_id,
        actionConfig.value
      )
      break
  }
}

async function addTagToContact(
  supabase: SupabaseClient,
  contactId: string,
  tagId: string
): Promise<void> {
  if (!tagId) return

  await supabase
    .from('contact_tags')
    .upsert(
      { contact_id: contactId, tag_id: tagId },
      { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
    )
}

async function removeTagFromContact(
  supabase: SupabaseClient,
  contactId: string,
  tagId: string
): Promise<void> {
  if (!tagId) return

  await supabase
    .from('contact_tags')
    .delete()
    .eq('contact_id', contactId)
    .eq('tag_id', tagId)
}

async function updateCustomField(
  supabase: SupabaseClient,
  contactId: string,
  fieldId: string,
  value: string
): Promise<void> {
  if (!fieldId) return

  await supabase
    .from('contact_custom_values')
    .upsert(
      {
        contact_id: contactId,
        field_id: fieldId,
        value
      },
      { onConflict: 'contact_id,field_id' }
    )
}
