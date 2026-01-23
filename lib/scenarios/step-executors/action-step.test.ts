import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeActionStep } from './action-step'
import type { ScenarioEnrollment, ScenarioStep } from '@/lib/types/l-step'

describe('executeActionStep', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  function createMockSupabase() {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })
    })

    return {
      from: vi.fn((table: string) => ({
        upsert: mockUpsert,
        delete: mockDelete
      })),
      mockUpsert,
      mockDelete
    }
  }

  beforeEach(() => {
    mockSupabase = createMockSupabase()
    vi.clearAllMocks()
  })

  const baseEnrollment: ScenarioEnrollment = {
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

  describe('add_tag action', () => {
    it('should add tag to contact', async () => {
      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'action',
        step_order: 1,
        name: 'Add Tag',
        config: {
          action_type: 'add_tag',
          action_config: { tag_id: 'tag-123' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeActionStep(mockSupabase as never, baseEnrollment, step)

      expect(mockSupabase.from).toHaveBeenCalledWith('contact_tags')
      expect(mockSupabase.mockUpsert).toHaveBeenCalledWith(
        { contact_id: 'contact-1', tag_id: 'tag-123' },
        { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
      )
    })

    it('should not add tag when tag_id is empty', async () => {
      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'action',
        step_order: 1,
        name: 'Add Tag',
        config: {
          action_type: 'add_tag',
          action_config: { tag_id: '' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeActionStep(mockSupabase as never, baseEnrollment, step)

      expect(mockSupabase.mockUpsert).not.toHaveBeenCalled()
    })
  })

  describe('remove_tag action', () => {
    it('should remove tag from contact', async () => {
      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'action',
        step_order: 1,
        name: 'Remove Tag',
        config: {
          action_type: 'remove_tag',
          action_config: { tag_id: 'tag-456' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeActionStep(mockSupabase as never, baseEnrollment, step)

      expect(mockSupabase.from).toHaveBeenCalledWith('contact_tags')
      expect(mockSupabase.mockDelete).toHaveBeenCalled()
    })

    it('should not remove tag when tag_id is empty', async () => {
      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'action',
        step_order: 1,
        name: 'Remove Tag',
        config: {
          action_type: 'remove_tag',
          action_config: { tag_id: '' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeActionStep(mockSupabase as never, baseEnrollment, step)

      expect(mockSupabase.mockDelete).not.toHaveBeenCalled()
    })
  })

  describe('update_field action', () => {
    it('should update custom field value', async () => {
      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'action',
        step_order: 1,
        name: 'Update Field',
        config: {
          action_type: 'update_field',
          action_config: {
            field_id: 'field-789',
            value: 'new-value'
          }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeActionStep(mockSupabase as never, baseEnrollment, step)

      expect(mockSupabase.from).toHaveBeenCalledWith('contact_custom_values')
      expect(mockSupabase.mockUpsert).toHaveBeenCalledWith(
        {
          contact_id: 'contact-1',
          field_id: 'field-789',
          value: 'new-value'
        },
        { onConflict: 'contact_id,field_id' }
      )
    })

    it('should not update field when field_id is empty', async () => {
      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'action',
        step_order: 1,
        name: 'Update Field',
        config: {
          action_type: 'update_field',
          action_config: {
            field_id: '',
            value: 'new-value'
          }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeActionStep(mockSupabase as never, baseEnrollment, step)

      expect(mockSupabase.mockUpsert).not.toHaveBeenCalled()
    })
  })

  describe('invalid config', () => {
    it('should do nothing when action_type is not set', async () => {
      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'action',
        step_order: 1,
        name: 'No Action',
        config: {
          action_config: { tag_id: 'tag-123' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeActionStep(mockSupabase as never, baseEnrollment, step)

      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('should do nothing when action_config is not set', async () => {
      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'action',
        step_order: 1,
        name: 'No Config',
        config: {
          action_type: 'add_tag'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeActionStep(mockSupabase as never, baseEnrollment, step)

      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })
})
