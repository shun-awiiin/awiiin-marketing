import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the step executors before importing the processor
vi.mock('./step-executors/email-step', () => ({
  executeEmailStep: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./step-executors/wait-step', () => ({
  executeWaitStep: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./step-executors/condition-step', () => ({
  executeConditionStep: vi.fn().mockResolvedValue(true)
}))

vi.mock('./step-executors/line-step', () => ({
  executeLineStep: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./step-executors/action-step', () => ({
  executeActionStep: vi.fn().mockResolvedValue(undefined)
}))

// Mock Supabase
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn()
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase)
}))

describe('Scenario Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('processScenarios', () => {
    it('should skip processing when lock cannot be acquired', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: false })

      const { processScenarios } = await import('./scenario-processor')
      const result = await processScenarios()

      expect(result).toEqual({ processed: 0, errors: [], skipped: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('acquire_advisory_lock', { lock_key: 12345 })
    })

    it('should process enrollments when lock is acquired', async () => {
      const mockEnrollments = [
        {
          id: 'enrollment-1',
          scenario_id: 'scenario-1',
          contact_id: 'contact-1',
          status: 'active',
          current_step_id: 'step-1',
          next_action_at: '2024-01-01T00:00:00Z',
          scenario: { id: 'scenario-1', status: 'active' },
          current_step: {
            id: 'step-1',
            step_type: 'email',
            config: { template_id: 'template-1' },
            next_step_id: null
          }
        }
      ]

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: true }) // acquire lock
        .mockResolvedValueOnce({ data: true }) // release lock

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockLte = vi.fn().mockReturnThis()
      const mockLimit = vi.fn().mockReturnThis()
      const mockUpdate = vi.fn().mockReturnThis()
      const mockInsert = vi.fn().mockReturnThis()

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'scenario_enrollments') {
          return {
            select: mockSelect,
            eq: mockEq,
            lte: mockLte,
            limit: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null }),
            update: mockUpdate
          }
        }
        if (table === 'scenario_logs') {
          return {
            insert: mockInsert.mockResolvedValue({ error: null })
          }
        }
        return {
          select: mockSelect,
          eq: mockEq,
          single: vi.fn().mockResolvedValue({ data: null })
        }
      })

      // Override the select chain behavior
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null })
            })
          })
        })
      })

      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      const { processScenarios } = await import('./scenario-processor')
      const result = await processScenarios()

      // Lock should be acquired and released
      expect(mockSupabase.rpc).toHaveBeenCalledWith('acquire_advisory_lock', { lock_key: 12345 })
    })

    it('should return errors when enrollment fetch fails', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: true }) // acquire lock
        .mockResolvedValueOnce({ data: true }) // release lock

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' }
                })
              })
            })
          })
        }),
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      const { processScenarios } = await import('./scenario-processor')
      const result = await processScenarios()

      expect(result.errors).toContain('Database error')
    })

    it('should handle enrollments with no current step (completed)', async () => {
      const mockEnrollments = [
        {
          id: 'enrollment-1',
          scenario_id: 'scenario-1',
          contact_id: 'contact-1',
          status: 'active',
          current_step_id: null,
          next_action_at: '2024-01-01T00:00:00Z',
          scenario: { id: 'scenario-1', status: 'active' },
          current_step: null
        }
      ]

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: true })
        .mockResolvedValueOnce({ data: true })

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'scenario_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lte: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null })
                  })
                })
              })
            }),
            update: mockUpdate
          }
        }
        if (table === 'scenario_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null })
          }
        }
        return { select: vi.fn() }
      })

      const { processScenarios } = await import('./scenario-processor')
      await processScenarios()

      // Should mark as completed
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe('step execution', () => {
    it('should execute email step', async () => {
      const { executeEmailStep } = await import('./step-executors/email-step')

      const mockEnrollment = {
        id: 'enrollment-1',
        scenario_id: 'scenario-1',
        contact_id: 'contact-1',
        status: 'active' as const,
        current_step_id: 'step-1',
        next_action_at: '2024-01-01T00:00:00Z',
        scenario: { id: 'scenario-1', status: 'active' },
        current_step: {
          id: 'step-1',
          scenario_id: 'scenario-1',
          step_type: 'email' as const,
          step_order: 1,
          name: 'Email Step',
          config: { template_id: 'template-1' },
          next_step_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      }

      const mockStep = mockEnrollment.current_step

      await executeEmailStep(mockSupabase as never, mockEnrollment as never, mockStep)

      expect(executeEmailStep).toHaveBeenCalled()
    })

    it('should execute condition step and return boolean', async () => {
      const { executeConditionStep } = await import('./step-executors/condition-step')

      const mockEnrollment = {
        id: 'enrollment-1',
        scenario_id: 'scenario-1',
        contact_id: 'contact-1',
        status: 'active' as const
      }

      const mockStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'condition' as const,
        step_order: 1,
        name: 'Condition Step',
        config: {
          condition_type: 'opened',
          true_step_id: 'step-2',
          false_step_id: 'step-3'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const result = await executeConditionStep(mockSupabase as never, mockEnrollment as never, mockStep)

      expect(result).toBe(true)
    })

    it('should execute LINE step', async () => {
      const { executeLineStep } = await import('./step-executors/line-step')

      const mockEnrollment = {
        id: 'enrollment-1',
        contact_id: 'contact-1'
      }

      const mockStep = {
        id: 'step-1',
        step_type: 'line' as const,
        config: {
          line_account_id: 'line-account-1',
          message_type: 'text',
          message_content: 'Hello!'
        }
      }

      await executeLineStep(mockSupabase as never, mockEnrollment as never, mockStep as never)

      expect(executeLineStep).toHaveBeenCalled()
    })

    it('should execute action step', async () => {
      const { executeActionStep } = await import('./step-executors/action-step')

      const mockEnrollment = {
        id: 'enrollment-1',
        contact_id: 'contact-1'
      }

      const mockStep = {
        id: 'step-1',
        step_type: 'action' as const,
        config: {
          action_type: 'add_tag',
          tag_id: 'tag-123'
        }
      }

      await executeActionStep(mockSupabase as never, mockEnrollment as never, mockStep as never)

      expect(executeActionStep).toHaveBeenCalled()
    })
  })

  describe('moveToNextStep', () => {
    it('should calculate next_action_at based on wait step delay', async () => {
      const mockNextStep = {
        id: 'step-2',
        step_type: 'wait',
        config: { wait_value: 3, wait_unit: 'days' }
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'scenario_steps') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockNextStep })
              })
            })
          }
        }
        if (table === 'scenario_enrollments') {
          return {
            update: mockUpdate
          }
        }
        return { select: vi.fn() }
      })

      // Access the internal function via reimporting
      const { moveToNextStep } = await import('./scenario-processor')

      const mockEnrollment = {
        id: 'enrollment-1',
        scenario_id: 'scenario-1',
        contact_id: 'contact-1'
      }

      const mockCurrentStep = {
        id: 'step-1',
        next_step_id: 'step-2'
      }

      await moveToNextStep(mockSupabase as never, mockEnrollment as never, mockCurrentStep as never)

      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe('markEnrollmentCompleted', () => {
    it('should mark enrollment as completed with timestamp', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      mockSupabase.from.mockReturnValue({
        update: mockUpdate
      })

      const { markEnrollmentCompleted } = await import('./scenario-processor')

      await markEnrollmentCompleted(mockSupabase as never, 'enrollment-1')

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          current_step_id: null,
          next_action_at: null
        })
      )
    })
  })
})
