import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeEmailStep } from './email-step'
import type { ScenarioEnrollment, ScenarioStep } from '@/lib/types/l-step'

// Mock the scenario-email module
vi.mock('@/lib/email/scenario-email', () => ({
  sendScenarioEmail: vi.fn().mockResolvedValue(undefined)
}))

describe('executeEmailStep', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  function createMockSupabase(contactData: unknown = null) {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })

    return {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: contactData }),
        insert: mockInsert
      })),
      mockInsert
    }
  }

  beforeEach(() => {
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

  describe('successful email sending', () => {
    it('should send email with variable substitution', async () => {
      const contact = {
        id: 'contact-1',
        email: 'test@example.com',
        first_name: 'John',
        company: 'Acme Inc'
      }
      mockSupabase = createMockSupabase(contact)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'email',
        step_order: 1,
        name: 'Welcome Email',
        config: {
          subject: 'Hello {{name}}!',
          content: '<p>Welcome to {{company}}</p>',
          from_name: 'Support',
          from_email: 'support@example.com'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeEmailStep(mockSupabase as never, baseEnrollment, step)

      const { sendScenarioEmail } = await import('@/lib/email/scenario-email')
      expect(sendScenarioEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Hello John!',
        html: '<p>Welcome to Acme Inc</p>',
        fromName: 'Support',
        fromEmail: 'support@example.com',
        contactId: 'contact-1',
        scenarioId: 'scenario-1',
        stepId: 'step-1'
      })
    })

    it('should use default subject when not provided', async () => {
      const contact = {
        id: 'contact-1',
        email: 'test@example.com'
      }
      mockSupabase = createMockSupabase(contact)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'email',
        step_order: 1,
        name: 'Notification',
        config: {
          content: '<p>Test content</p>'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeEmailStep(mockSupabase as never, baseEnrollment, step)

      const { sendScenarioEmail } = await import('@/lib/email/scenario-email')
      expect(sendScenarioEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'お知らせ'
        })
      )
    })
  })

  describe('contact validation', () => {
    it('should throw error when contact has no email', async () => {
      const contact = {
        id: 'contact-1',
        first_name: 'John'
        // No email
      }
      mockSupabase = createMockSupabase(contact)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'email',
        step_order: 1,
        name: 'Test Email',
        config: {
          subject: 'Test',
          content: 'Test content'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await expect(executeEmailStep(mockSupabase as never, baseEnrollment, step))
        .rejects.toThrow('Contact has no email address')
    })

    it('should throw error when contact is not found', async () => {
      mockSupabase = createMockSupabase(null)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'email',
        step_order: 1,
        name: 'Test Email',
        config: {
          subject: 'Test',
          content: 'Test content'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await expect(executeEmailStep(mockSupabase as never, baseEnrollment, step))
        .rejects.toThrow('Contact has no email address')
    })
  })

  describe('fallback behavior', () => {
    it('should record email event when sendScenarioEmail fails', async () => {
      const contact = {
        id: 'contact-1',
        email: 'test@example.com',
        first_name: 'John'
      }
      mockSupabase = createMockSupabase(contact)

      // Mock sendScenarioEmail to throw
      const { sendScenarioEmail } = await import('@/lib/email/scenario-email')
      vi.mocked(sendScenarioEmail).mockRejectedValueOnce(new Error('Email service unavailable'))

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'email',
        step_order: 1,
        name: 'Test Email',
        config: {
          subject: 'Test Subject',
          content: 'Test content'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      // Should not throw
      await executeEmailStep(mockSupabase as never, baseEnrollment, step)

      // Should record the event
      expect(mockSupabase.mockInsert).toHaveBeenCalledWith({
        contact_id: 'contact-1',
        email_id: 'scenario_scenario-1_step_step-1',
        event_type: 'sent',
        metadata: {
          scenario_id: 'scenario-1',
          step_id: 'step-1',
          subject: 'Test Subject'
        }
      })
    })
  })

  describe('variable substitution', () => {
    it('should substitute all variables correctly', async () => {
      const contact = {
        id: 'contact-1',
        email: 'john@company.com',
        first_name: 'John',
        company: 'Tech Corp'
      }
      mockSupabase = createMockSupabase(contact)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'email',
        step_order: 1,
        name: 'Variables Test',
        config: {
          subject: 'Hello {{name}} from {{company}}',
          content: '<p>Hi {{firstName}}, your email is {{email}}</p>'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeEmailStep(mockSupabase as never, baseEnrollment, step)

      const { sendScenarioEmail } = await import('@/lib/email/scenario-email')
      expect(sendScenarioEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Hello John from Tech Corp',
          html: '<p>Hi John, your email is john@company.com</p>'
        })
      )
    })

    it('should handle missing contact fields gracefully', async () => {
      const contact = {
        id: 'contact-1',
        email: 'test@example.com'
        // No first_name or company
      }
      mockSupabase = createMockSupabase(contact)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'email',
        step_order: 1,
        name: 'Missing Fields Test',
        config: {
          subject: 'Hello {{name}}',
          content: '<p>Company: {{company}}</p>'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeEmailStep(mockSupabase as never, baseEnrollment, step)

      const { sendScenarioEmail } = await import('@/lib/email/scenario-email')
      expect(sendScenarioEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Hello ',
          html: '<p>Company: </p>'
        })
      )
    })
  })
})
