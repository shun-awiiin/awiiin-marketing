import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create mock functions
const mockPushMessage = vi.fn().mockResolvedValue(undefined)
const mockBuildTextMessage = vi.fn((text: string) => ({ type: 'text', text }))
const mockBuildFlexMessage = vi.fn((altText: string, contents: unknown) => ({
  type: 'flex',
  altText,
  contents
}))

// Mock the LINE client module
vi.mock('@/lib/line/line-client', () => ({
  LineClient: class MockLineClient {
    constructor() {}
    pushMessage = mockPushMessage
  },
  buildTextMessage: (text: string) => mockBuildTextMessage(text),
  buildFlexMessage: (altText: string, contents: unknown) => mockBuildFlexMessage(altText, contents)
}))

import { executeLineStep } from './line-step'
import type { ScenarioEnrollment, ScenarioStep } from '@/lib/types/l-step'

describe('executeLineStep', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  function createMockSupabase(
    lineLink: unknown | null = null,
    insertSuccess = true
  ) {
    const mockInsert = vi.fn().mockResolvedValue({
      error: insertSuccess ? null : { message: 'Insert failed' }
    })

    return {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: lineLink, error: null }),
        insert: mockInsert
      })),
      mockInsert
    }
  }

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

  beforeEach(() => {
    vi.clearAllMocks()
    mockPushMessage.mockResolvedValue(undefined)
  })

  describe('when contact has no LINE link', () => {
    it('should skip silently without errors', async () => {
      mockSupabase = createMockSupabase(null)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'line',
        step_order: 1,
        name: 'LINE Message',
        config: {
          line_message_type: 'text',
          line_content: { text: 'Hello!' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeLineStep(mockSupabase as never, baseEnrollment, step)

      expect(mockSupabase.mockInsert).not.toHaveBeenCalled()
    })
  })

  describe('when contact has LINE link', () => {
    const lineLink = {
      id: 'link-1',
      contact_id: 'contact-1',
      line_user_id: 'U1234567890',
      line_account_id: 'account-1',
      status: 'active',
      line_account: {
        id: 'account-1',
        access_token: 'test-token',
        channel_secret: 'test-secret'
      }
    }

    it('should send text message successfully', async () => {
      mockSupabase = createMockSupabase(lineLink)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'line',
        step_order: 1,
        name: 'LINE Text Message',
        config: {
          line_message_type: 'text',
          line_content: { text: 'Hello from scenario!' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeLineStep(mockSupabase as never, baseEnrollment, step)

      expect(mockPushMessage).toHaveBeenCalled()
      expect(mockSupabase.mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          line_account_id: 'account-1',
          contact_id: 'contact-1',
          line_user_id: 'U1234567890',
          message_type: 'sent',
          status: 'sent'
        })
      )
    })

    it('should send flex message successfully', async () => {
      mockSupabase = createMockSupabase(lineLink)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'line',
        step_order: 1,
        name: 'LINE Flex Message',
        config: {
          line_message_type: 'flex',
          line_content: {
            altText: 'Flex message',
            contents: {
              type: 'bubble',
              body: { type: 'box', layout: 'vertical', contents: [] }
            }
          }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeLineStep(mockSupabase as never, baseEnrollment, step)

      expect(mockPushMessage).toHaveBeenCalled()
      expect(mockSupabase.mockInsert).toHaveBeenCalled()
    })

    it('should handle default message type as text', async () => {
      mockSupabase = createMockSupabase(lineLink)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'line',
        step_order: 1,
        name: 'LINE Message',
        config: {
          line_content: { text: 'Default text message' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeLineStep(mockSupabase as never, baseEnrollment, step)

      expect(mockPushMessage).toHaveBeenCalled()
      expect(mockSupabase.mockInsert).toHaveBeenCalled()
    })

    it('should not send when no message content', async () => {
      mockSupabase = createMockSupabase(lineLink)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'line',
        step_order: 1,
        name: 'LINE Message',
        config: {
          line_message_type: 'text'
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeLineStep(mockSupabase as never, baseEnrollment, step)

      expect(mockPushMessage).not.toHaveBeenCalled()
      expect(mockSupabase.mockInsert).not.toHaveBeenCalled()
    })

    it('should log error when LINE API fails', async () => {
      mockPushMessage.mockRejectedValueOnce(new Error('LINE API Error'))
      mockSupabase = createMockSupabase(lineLink)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'line',
        step_order: 1,
        name: 'LINE Message',
        config: {
          line_message_type: 'text',
          line_content: { text: 'Hello!' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      // Should not throw
      await executeLineStep(mockSupabase as never, baseEnrollment, step)

      // Should log error
      expect(mockSupabase.mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: expect.stringContaining('LINE API Error')
        })
      )
    })
  })

  describe('when line_account is missing', () => {
    it('should skip when line_account is null', async () => {
      const linkWithoutAccount = {
        id: 'link-1',
        contact_id: 'contact-1',
        line_user_id: 'U1234567890',
        line_account_id: 'account-1',
        status: 'active',
        line_account: null
      }

      mockSupabase = createMockSupabase(linkWithoutAccount)

      const step: ScenarioStep = {
        id: 'step-1',
        scenario_id: 'scenario-1',
        step_type: 'line',
        step_order: 1,
        name: 'LINE Message',
        config: {
          line_message_type: 'text',
          line_content: { text: 'Hello!' }
        },
        next_step_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      await executeLineStep(mockSupabase as never, baseEnrollment, step)

      expect(mockPushMessage).not.toHaveBeenCalled()
      expect(mockSupabase.mockInsert).not.toHaveBeenCalled()
    })
  })
})
