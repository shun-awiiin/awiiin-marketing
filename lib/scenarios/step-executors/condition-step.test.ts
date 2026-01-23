import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeConditionStep, evaluateCondition } from './condition-step'
import type { ScenarioEnrollment, ScenarioStep, ConditionConfig } from '@/lib/types/l-step'

describe('executeConditionStep', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  function createMockSupabase() {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })

    return {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        single: vi.fn().mockResolvedValue({ data: null }),
        update: mockUpdate
      })),
      mockUpdate
    }
  }

  beforeEach(() => {
    mockSupabase = createMockSupabase()
    vi.clearAllMocks()
  })

  it('should return true when no condition type is set', async () => {
    const enrollment: ScenarioEnrollment = {
      id: 'enrollment-1',
      scenario_id: 'scenario-1',
      contact_id: 'contact-1',
      status: 'active',
      current_step_id: 'step-1',
      enrolled_at: '2024-01-01T00:00:00Z',
      next_action_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const step: ScenarioStep = {
      id: 'step-1',
      scenario_id: 'scenario-1',
      step_type: 'condition',
      step_order: 1,
      name: 'Condition Step',
      config: {},
      condition_type: undefined,
      condition_config: {},
      next_step_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const result = await executeConditionStep(mockSupabase as never, enrollment, step)
    expect(result).toBe(true)
  })

  it('should navigate to yes path when condition is met', async () => {
    // Mock that email was opened
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'event-1' }] }),
      update: mockSupabase.mockUpdate
    })

    const enrollment: ScenarioEnrollment = {
      id: 'enrollment-1',
      scenario_id: 'scenario-1',
      contact_id: 'contact-1',
      status: 'active',
      current_step_id: 'step-1',
      enrolled_at: '2024-01-01T00:00:00Z',
      next_action_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const step: ScenarioStep = {
      id: 'step-1',
      scenario_id: 'scenario-1',
      step_type: 'condition',
      step_order: 1,
      name: 'Opened Check',
      config: {},
      condition_type: 'opened',
      condition_config: { email_id: 'email-1' },
      condition_yes_step_id: 'step-2',
      condition_no_step_id: 'step-3',
      next_step_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const result = await executeConditionStep(mockSupabase as never, enrollment, step)

    expect(result).toBe(false) // Don't use default advance
    expect(mockSupabase.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        current_step_id: 'step-2'
      })
    )
  })

  it('should navigate to no path when condition times out', async () => {
    // Mock no events found
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
      update: mockSupabase.mockUpdate
    })

    const enrollment: ScenarioEnrollment = {
      id: 'enrollment-1',
      scenario_id: 'scenario-1',
      contact_id: 'contact-1',
      status: 'active',
      current_step_id: 'step-1',
      // Enrolled 8 days ago (past default 7-day timeout)
      enrolled_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      next_action_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const step: ScenarioStep = {
      id: 'step-1',
      scenario_id: 'scenario-1',
      step_type: 'condition',
      step_order: 1,
      name: 'Opened Check',
      config: {},
      condition_type: 'opened',
      condition_config: { email_id: 'email-1' },
      condition_yes_step_id: 'step-2',
      condition_no_step_id: 'step-3',
      next_step_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const result = await executeConditionStep(mockSupabase as never, enrollment, step)

    expect(result).toBe(false)
    expect(mockSupabase.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        current_step_id: 'step-3'
      })
    )
  })
})

describe('evaluateCondition', () => {
  function createMockSupabase(responseData: unknown[] | null = []) {
    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: responseData }),
        single: vi.fn().mockResolvedValue({ data: responseData ? responseData[0] : null })
      })
    }
  }

  const baseEnrollment: ScenarioEnrollment = {
    id: 'enrollment-1',
    scenario_id: 'scenario-1',
    contact_id: 'contact-1',
    status: 'active',
    current_step_id: 'step-1',
    enrolled_at: new Date().toISOString(),
    next_action_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  describe('opened condition', () => {
    it('should return met=true when email was opened', async () => {
      const supabase = createMockSupabase([{ id: 'event-1' }])
      const config: ConditionConfig = { email_id: 'email-1' }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'opened', config)

      expect(result.met).toBe(true)
      expect(result.timedOut).toBe(false)
    })

    it('should return met=false when email was not opened', async () => {
      const supabase = createMockSupabase([])
      const config: ConditionConfig = { email_id: 'email-1' }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'opened', config)

      expect(result.met).toBe(false)
    })
  })

  describe('clicked condition', () => {
    it('should return met=true when link was clicked', async () => {
      const supabase = createMockSupabase([{ id: 'event-1' }])
      const config: ConditionConfig = { email_id: 'email-1' }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'clicked', config)

      expect(result.met).toBe(true)
      expect(result.timedOut).toBe(false)
    })
  })

  describe('not_opened condition', () => {
    it('should return met=true when timed out and not opened', async () => {
      const supabase = createMockSupabase([])
      const config: ConditionConfig = { email_id: 'email-1' }
      const oldEnrollment = {
        ...baseEnrollment,
        enrolled_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      }

      const result = await evaluateCondition(supabase as never, oldEnrollment, 'not_opened', config)

      expect(result.met).toBe(true)
      expect(result.timedOut).toBe(true)
    })

    it('should return met=false when timed out but was opened', async () => {
      const supabase = createMockSupabase([{ id: 'event-1' }])
      const config: ConditionConfig = { email_id: 'email-1' }
      const oldEnrollment = {
        ...baseEnrollment,
        enrolled_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      }

      const result = await evaluateCondition(supabase as never, oldEnrollment, 'not_opened', config)

      expect(result.met).toBe(false)
      expect(result.timedOut).toBe(true)
    })

    it('should return met=false when not yet timed out', async () => {
      const supabase = createMockSupabase([])
      const config: ConditionConfig = { email_id: 'email-1' }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'not_opened', config)

      expect(result.met).toBe(false)
      expect(result.timedOut).toBe(false)
    })
  })

  describe('has_tag condition', () => {
    it('should return met=true when contact has tag', async () => {
      const supabase = createMockSupabase([{ contact_id: 'contact-1', tag_id: 'tag-1' }])
      const config: ConditionConfig = { tag_id: 'tag-1' }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'has_tag', config)

      expect(result.met).toBe(true)
    })

    it('should return met=false when contact does not have tag', async () => {
      const supabase = createMockSupabase([])
      const config: ConditionConfig = { tag_id: 'tag-1' }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'has_tag', config)

      expect(result.met).toBe(false)
    })
  })

  describe('custom_field condition', () => {
    it('should return met=true when field equals value', async () => {
      const supabase = createMockSupabase([{ value: 'Tokyo' }])
      const config: ConditionConfig = {
        field_id: 'field-1',
        field_value: 'Tokyo',
        field_operator: 'equals'
      }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'custom_field', config)

      expect(result.met).toBe(true)
    })

    it('should return met=false when field does not equal value', async () => {
      const supabase = createMockSupabase([{ value: 'Osaka' }])
      const config: ConditionConfig = {
        field_id: 'field-1',
        field_value: 'Tokyo',
        field_operator: 'equals'
      }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'custom_field', config)

      expect(result.met).toBe(false)
    })

    it('should handle not_equals operator', async () => {
      const supabase = createMockSupabase([{ value: 'Osaka' }])
      const config: ConditionConfig = {
        field_id: 'field-1',
        field_value: 'Tokyo',
        field_operator: 'not_equals'
      }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'custom_field', config)

      expect(result.met).toBe(true)
    })

    it('should handle contains operator', async () => {
      const supabase = createMockSupabase([{ value: 'Hello World' }])
      const config: ConditionConfig = {
        field_id: 'field-1',
        field_value: 'World',
        field_operator: 'contains'
      }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'custom_field', config)

      expect(result.met).toBe(true)
    })

    it('should handle greater operator', async () => {
      const supabase = createMockSupabase([{ value: '100' }])
      const config: ConditionConfig = {
        field_id: 'field-1',
        field_value: '50',
        field_operator: 'greater'
      }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'custom_field', config)

      expect(result.met).toBe(true)
    })

    it('should handle less operator', async () => {
      const supabase = createMockSupabase([{ value: '30' }])
      const config: ConditionConfig = {
        field_id: 'field-1',
        field_value: '50',
        field_operator: 'less'
      }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'custom_field', config)

      expect(result.met).toBe(true)
    })

    it('should return met=false when custom field not found', async () => {
      const supabase = createMockSupabase(null)
      const config: ConditionConfig = {
        field_id: 'field-1',
        field_value: 'Tokyo',
        field_operator: 'equals'
      }

      const result = await evaluateCondition(supabase as never, baseEnrollment, 'custom_field', config)

      expect(result.met).toBe(false)
    })
  })

  describe('unknown condition type', () => {
    it('should return met=false for unknown condition type', async () => {
      const supabase = createMockSupabase([])
      const config: ConditionConfig = {}

      const result = await evaluateCondition(
        supabase as never,
        baseEnrollment,
        'unknown' as never,
        config
      )

      expect(result.met).toBe(false)
      expect(result.timedOut).toBe(false)
    })
  })

  describe('timeout calculation', () => {
    it('should use custom timeout in minutes', async () => {
      const supabase = createMockSupabase([])
      const config: ConditionConfig = {
        email_id: 'email-1',
        timeout_value: 30,
        timeout_unit: 'minutes'
      }
      // Enrolled 31 minutes ago
      const enrollment = {
        ...baseEnrollment,
        enrolled_at: new Date(Date.now() - 31 * 60 * 1000).toISOString()
      }

      const result = await evaluateCondition(supabase as never, enrollment, 'opened', config)

      expect(result.timedOut).toBe(true)
    })

    it('should use custom timeout in hours', async () => {
      const supabase = createMockSupabase([])
      const config: ConditionConfig = {
        email_id: 'email-1',
        timeout_value: 2,
        timeout_unit: 'hours'
      }
      // Enrolled 3 hours ago
      const enrollment = {
        ...baseEnrollment,
        enrolled_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      }

      const result = await evaluateCondition(supabase as never, enrollment, 'opened', config)

      expect(result.timedOut).toBe(true)
    })

    it('should use custom timeout in days', async () => {
      const supabase = createMockSupabase([])
      const config: ConditionConfig = {
        email_id: 'email-1',
        timeout_value: 3,
        timeout_unit: 'days'
      }
      // Enrolled 4 days ago
      const enrollment = {
        ...baseEnrollment,
        enrolled_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      }

      const result = await evaluateCondition(supabase as never, enrollment, 'opened', config)

      expect(result.timedOut).toBe(true)
    })

    it('should not timeout within custom period', async () => {
      const supabase = createMockSupabase([])
      const config: ConditionConfig = {
        email_id: 'email-1',
        timeout_value: 3,
        timeout_unit: 'days'
      }
      // Enrolled 2 days ago
      const enrollment = {
        ...baseEnrollment,
        enrolled_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }

      const result = await evaluateCondition(supabase as never, enrollment, 'opened', config)

      expect(result.timedOut).toBe(false)
    })
  })
})
