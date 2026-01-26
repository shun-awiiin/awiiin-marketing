import type { SupabaseClient } from '@supabase/supabase-js'
import type { SegmentRules, SegmentCondition } from '@/lib/types/l-step'

interface Contact {
  id: string
  email: string
  first_name?: string
  company?: string
  status: string
  created_at: string
}

export async function evaluateSegment(
  supabase: SupabaseClient,
  userId: string,
  rules: SegmentRules
): Promise<Contact[]> {
  const { operator, conditions } = rules

  if (conditions.length === 0) {
    // No conditions = all contacts
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
    return data || []
  }

  if (operator === 'AND') {
    return evaluateAnd(supabase, userId, conditions)
  } else {
    return evaluateOr(supabase, userId, conditions)
  }
}

async function evaluateAnd(
  supabase: SupabaseClient,
  userId: string,
  conditions: SegmentCondition[]
): Promise<Contact[]> {
  // Start with all contacts
  let contactIds: string[] | null = null

  for (const condition of conditions) {
    const matchingIds = await getContactIdsForCondition(supabase, userId, condition)

    if (contactIds === null) {
      contactIds = matchingIds
    } else {
      // Intersection
      const matchingSet = new Set(matchingIds)
      contactIds = contactIds.filter(id => matchingSet.has(id))
    }

    // Early exit if no matches
    if (contactIds.length === 0) {
      return []
    }
  }

  if (!contactIds || contactIds.length === 0) {
    return []
  }

  const { data } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('id', contactIds)

  return data || []
}

async function evaluateOr(
  supabase: SupabaseClient,
  userId: string,
  conditions: SegmentCondition[]
): Promise<Contact[]> {
  const allIds = new Set<string>()

  for (const condition of conditions) {
    const matchingIds = await getContactIdsForCondition(supabase, userId, condition)
    matchingIds.forEach(id => allIds.add(id))
  }

  if (allIds.size === 0) {
    return []
  }

  const { data } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('id', Array.from(allIds))

  return data || []
}

async function getContactIdsForCondition(
  supabase: SupabaseClient,
  userId: string,
  condition: SegmentCondition
): Promise<string[]> {
  switch (condition.type) {
    case 'tag':
      return getContactIdsByTag(supabase, userId, condition)
    case 'custom_field':
      return getContactIdsByCustomField(supabase, userId, condition)
    case 'email_activity':
      return getContactIdsByEmailActivity(supabase, userId, condition)
    case 'created_at':
      return getContactIdsByCreatedAt(supabase, userId, condition)
    case 'status':
      return getContactIdsByStatus(supabase, userId, condition)
    default:
      return []
  }
}

async function getContactIdsByTag(
  supabase: SupabaseClient,
  userId: string,
  condition: SegmentCondition
): Promise<string[]> {
  const tagId = condition.value as string

  if (!tagId) {
    console.error('Tag ID is empty')
    return []
  }

  if (condition.operator === 'exists') {
    // Use JOIN query via RPC or direct query to avoid .in() limitation
    // Get contacts that have this tag AND belong to this user
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        contact_tags!inner (
          tag_id
        )
      `)
      .eq('user_id', userId)
      .eq('contact_tags.tag_id', tagId)

    if (error) {
      console.error('Error fetching tagged contacts:', error.message)
      return []
    }

    return data?.map(c => c.id) || []
  } else if (condition.operator === 'not_exists') {
    // Get all user contacts
    const { data: allContacts, error: allError } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)

    if (allError || !allContacts) {
      console.error('Error fetching all contacts:', allError?.message)
      return []
    }

    // Get contacts WITH this tag (using JOIN)
    const { data: taggedData } = await supabase
      .from('contacts')
      .select(`
        id,
        contact_tags!inner (
          tag_id
        )
      `)
      .eq('user_id', userId)
      .eq('contact_tags.tag_id', tagId)

    const taggedSet = new Set(taggedData?.map(c => c.id) || [])
    return allContacts
      .filter(c => !taggedSet.has(c.id))
      .map(c => c.id)
  }

  return []
}

async function getContactIdsByCustomField(
  supabase: SupabaseClient,
  userId: string,
  condition: SegmentCondition
): Promise<string[]> {
  const fieldId = condition.field
  const value = condition.value

  if (!fieldId) return []

  let query = supabase
    .from('contact_custom_values')
    .select('contact_id')
    .eq('field_id', fieldId)

  switch (condition.operator) {
    case 'equals':
      query = query.eq('value', String(value))
      break
    case 'not_equals':
      query = query.neq('value', String(value))
      break
    case 'contains':
      query = query.ilike('value', `%${value}%`)
      break
    case 'greater':
      query = query.gt('value', String(value))
      break
    case 'less':
      query = query.lt('value', String(value))
      break
    case 'exists':
      // Just having a value
      query = query.not('value', 'is', null)
      break
    case 'not_exists':
      query = query.is('value', null)
      break
  }

  const { data } = await query

  if (!data) return []

  // Filter to user's contacts
  const { data: userContacts } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .in('id', data.map(d => d.contact_id))

  return userContacts?.map(c => c.id) || []
}

async function getContactIdsByEmailActivity(
  supabase: SupabaseClient,
  userId: string,
  condition: SegmentCondition
): Promise<string[]> {
  const eventType = condition.value as string

  const { data: events } = await supabase
    .from('email_events')
    .select('contact_id')
    .eq('event_type', eventType)

  if (!events) return []

  const contactIds = [...new Set(events.map(e => e.contact_id))]

  // Filter to user's contacts
  const { data: userContacts } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .in('id', contactIds)

  return userContacts?.map(c => c.id) || []
}

async function getContactIdsByCreatedAt(
  supabase: SupabaseClient,
  userId: string,
  condition: SegmentCondition
): Promise<string[]> {
  const dateValue = condition.value as string

  let query = supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)

  switch (condition.operator) {
    case 'greater':
      query = query.gte('created_at', dateValue)
      break
    case 'less':
      query = query.lte('created_at', dateValue)
      break
    case 'equals':
      // Match same day
      const startOfDay = new Date(dateValue)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(dateValue)
      endOfDay.setHours(23, 59, 59, 999)
      query = query
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
      break
  }

  const { data } = await query
  return data?.map(c => c.id) || []
}

async function getContactIdsByStatus(
  supabase: SupabaseClient,
  userId: string,
  condition: SegmentCondition
): Promise<string[]> {
  const status = condition.value as string

  const { data } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', status)

  return data?.map(c => c.id) || []
}

export async function countSegmentContacts(
  supabase: SupabaseClient,
  userId: string,
  rules: SegmentRules
): Promise<number> {
  const contacts = await evaluateSegment(supabase, userId, rules)
  return contacts.length
}
