import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies - define mock objects outside vi.mock()
const mockSupabase = {
  from: vi.fn(),
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase)
}))

const mockVerifySignature = vi.fn((body: string, signature: string) => signature === 'valid-signature')
const mockGetProfile = vi.fn().mockResolvedValue({
  displayName: 'Test User',
  userId: 'U123',
  pictureUrl: 'https://example.com/pic.jpg'
})

vi.mock('@/lib/line/line-client', () => ({
  LineClient: class MockLineClient {
    constructor() {}
    verifySignature = mockVerifySignature
    getProfile = mockGetProfile
  }
}))

const mockConsumeToken = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/line/line-linker', () => ({
  consumeToken: mockConsumeToken
}))

describe('LINE Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } }
    })
    mockVerifySignature.mockImplementation((body: string, signature: string) => signature === 'valid-signature')
    mockGetProfile.mockResolvedValue({
      displayName: 'Test User',
      userId: 'U123',
      pictureUrl: 'https://example.com/pic.jpg'
    })

    const mockFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis()
    }))

    mockSupabase.from = mockFrom
  })

  describe('POST /api/webhooks/line', () => {
    it('should return 400 for invalid JSON', async () => {
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/webhooks/line', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'x-line-signature': 'test-signature'
        }
      })

      const response = await POST(request as never)
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error).toBe('Invalid JSON')
    })

    it('should return 200 for unknown account (LINE requirement)', async () => {
      // No accounts in database
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null })
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/webhooks/line', {
        method: 'POST',
        body: JSON.stringify({
          destination: 'unknown-bot',
          events: []
        }),
        headers: {
          'x-line-signature': 'some-signature'
        }
      })

      const response = await POST(request as never)
      expect(response.status).toBe(200)
    })

    it('should process follow event', async () => {
      const mockAccount = {
        id: 'account-1',
        user_id: 'user-1',
        access_token: 'test-token',
        channel_secret: 'test-secret',
        bot_basic_id: '@test'
      }

      const mockInsert = vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null })
      const mockSelect = vi.fn().mockReturnThis()

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'line_accounts') {
          return {
            select: vi.fn().mockResolvedValue({ data: [mockAccount], error: null })
          }
        }
        if (table === 'contact_line_links') {
          return {
            select: mockSelect,
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            insert: mockInsert,
            update: vi.fn().mockReturnThis()
          }
        }
        if (table === 'contacts') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: mockSelect,
            single: vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null })
          }
        }
        return {
          select: mockSelect,
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: mockInsert
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/webhooks/line', {
        method: 'POST',
        body: JSON.stringify({
          destination: '@test',
          events: [{
            type: 'follow',
            source: { type: 'user', userId: 'U12345' },
            timestamp: Date.now()
          }]
        }),
        headers: {
          'x-line-signature': 'valid-signature'
        }
      })

      const response = await POST(request as never)
      expect(response.status).toBe(200)
    })

    it('should process unfollow event', async () => {
      const mockAccount = {
        id: 'account-1',
        user_id: 'user-1',
        access_token: 'test-token',
        channel_secret: 'test-secret'
      }

      const mockUpdate = vi.fn().mockReturnThis()
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'line_accounts') {
          return {
            select: vi.fn().mockResolvedValue({ data: [mockAccount], error: null })
          }
        }
        return {
          update: mockUpdate,
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/webhooks/line', {
        method: 'POST',
        body: JSON.stringify({
          destination: '@test',
          events: [{
            type: 'unfollow',
            source: { type: 'user', userId: 'U12345' },
            timestamp: Date.now()
          }]
        }),
        headers: {
          'x-line-signature': 'valid-signature'
        }
      })

      const response = await POST(request as never)
      expect(response.status).toBe(200)
    })

    it('should process message event', async () => {
      const mockAccount = {
        id: 'account-1',
        user_id: 'user-1',
        access_token: 'test-token',
        channel_secret: 'test-secret'
      }

      const mockInsert = vi.fn().mockResolvedValue({ error: null })
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'line_accounts') {
          return {
            select: vi.fn().mockResolvedValue({ data: [mockAccount], error: null })
          }
        }
        if (table === 'contact_line_links') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { contact_id: 'contact-1' }, error: null })
          }
        }
        if (table === 'line_messages') {
          return {
            insert: mockInsert
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/webhooks/line', {
        method: 'POST',
        body: JSON.stringify({
          destination: '@test',
          events: [{
            type: 'message',
            source: { type: 'user', userId: 'U12345' },
            timestamp: Date.now(),
            message: {
              type: 'text',
              id: 'msg-1',
              text: 'Hello!'
            }
          }]
        }),
        headers: {
          'x-line-signature': 'valid-signature'
        }
      })

      const response = await POST(request as never)
      expect(response.status).toBe(200)
    })

    it('should process postback event with link_token action', async () => {
      const mockAccount = {
        id: 'account-1',
        user_id: 'user-1',
        access_token: 'test-token',
        channel_secret: 'test-secret'
      }

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'line_accounts') {
          return {
            select: vi.fn().mockResolvedValue({ data: [mockAccount], error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/webhooks/line', {
        method: 'POST',
        body: JSON.stringify({
          destination: '@test',
          events: [{
            type: 'postback',
            source: { type: 'user', userId: 'U12345' },
            timestamp: Date.now(),
            postback: {
              data: 'action=link_token&token=abc123'
            }
          }]
        }),
        headers: {
          'x-line-signature': 'valid-signature'
        }
      })

      const response = await POST(request as never)
      expect(response.status).toBe(200)
      expect(mockConsumeToken).toHaveBeenCalled()
    })

    it('should process postback event with scenario_trigger action', async () => {
      const mockAccount = {
        id: 'account-1',
        user_id: 'user-1',
        access_token: 'test-token',
        channel_secret: 'test-secret'
      }

      const mockUpsert = vi.fn().mockResolvedValue({ error: null })
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'line_accounts') {
          return {
            select: vi.fn().mockResolvedValue({ data: [mockAccount], error: null })
          }
        }
        if (table === 'contact_line_links') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { contact_id: 'contact-1' }, error: null })
          }
        }
        if (table === 'scenario_steps') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'step-1' }, error: null })
          }
        }
        if (table === 'scenario_enrollments') {
          return {
            upsert: mockUpsert
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/webhooks/line', {
        method: 'POST',
        body: JSON.stringify({
          destination: '@test',
          events: [{
            type: 'postback',
            source: { type: 'user', userId: 'U12345' },
            timestamp: Date.now(),
            postback: {
              data: 'action=scenario_trigger&scenario_id=scenario-1'
            }
          }]
        }),
        headers: {
          'x-line-signature': 'valid-signature'
        }
      })

      const response = await POST(request as never)
      expect(response.status).toBe(200)
    })

    it('should skip events without userId', async () => {
      const mockAccount = {
        id: 'account-1',
        user_id: 'user-1',
        access_token: 'test-token',
        channel_secret: 'test-secret'
      }

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'line_accounts') {
          return {
            select: vi.fn().mockResolvedValue({ data: [mockAccount], error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/webhooks/line', {
        method: 'POST',
        body: JSON.stringify({
          destination: '@test',
          events: [{
            type: 'follow',
            source: { type: 'group', groupId: 'G123' }, // No userId
            timestamp: Date.now()
          }]
        }),
        headers: {
          'x-line-signature': 'valid-signature'
        }
      })

      const response = await POST(request as never)
      expect(response.status).toBe(200)
    })
  })
})
