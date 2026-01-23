import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies - define mock objects outside vi.mock()
const mockSupabase = {
  from: vi.fn(),
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase)
}))

const mockCreateLinkToken = vi.fn().mockResolvedValue({
  token: 'test-token-123',
  linkUrl: 'https://example.com/line/link?token=test-token-123'
})

vi.mock('@/lib/line/line-linker', () => ({
  createLinkToken: mockCreateLinkToken
}))

describe('Contact LINE Link API', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } }
    })

    mockSupabase.from = vi.fn()
    mockCreateLinkToken.mockResolvedValue({
      token: 'test-token-123',
      linkUrl: 'https://example.com/line/link?token=test-token-123'
    })
  })

  describe('GET /api/contacts/[id]/line-link', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null }
      })

      vi.resetModules()
      const { GET } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link')
      const response = await GET(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(401)
    })

    it('should return 404 when contact not found', async () => {
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { GET } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link')
      const response = await GET(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(404)
    })

    it('should return LINE links for contact', async () => {
      const mockLinks = [
        {
          id: 'link-1',
          line_user_id: 'U123',
          display_name: 'Test User',
          status: 'active',
          line_account: { id: 'account-1', display_name: 'Test Bot' }
        }
      ]

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null })
          }
        }
        if (table === 'contact_line_links') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockLinks, error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { GET } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link')
      const response = await GET(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data).toEqual(mockLinks)
    })
  })

  describe('POST /api/contacts/[id]/line-link', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link', {
        method: 'POST',
        body: JSON.stringify({ line_account_id: 'account-1' })
      })
      const response = await POST(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(401)
    })

    it('should return 400 for invalid request body', async () => {
      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link', {
        method: 'POST',
        body: JSON.stringify({ invalid_field: 'value' })
      })
      const response = await POST(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(400)
    })

    it('should return 404 when contact not found', async () => {
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link', {
        method: 'POST',
        body: JSON.stringify({ line_account_id: '550e8400-e29b-41d4-a716-446655440000' })
      })
      const response = await POST(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(404)
    })

    it('should return 404 when LINE account not found', async () => {
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null })
          }
        }
        if (table === 'line_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link', {
        method: 'POST',
        body: JSON.stringify({ line_account_id: '550e8400-e29b-41d4-a716-446655440000' })
      })
      const response = await POST(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(404)
    })

    it('should return 400 when already linked', async () => {
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null })
          }
        }
        if (table === 'line_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'account-1' }, error: null })
          }
        }
        if (table === 'contact_line_links') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'existing-link' }, error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link', {
        method: 'POST',
        body: JSON.stringify({ line_account_id: '550e8400-e29b-41d4-a716-446655440000' })
      })
      const response = await POST(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('既に')
    })

    it('should create link token successfully', async () => {
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null })
          }
        }
        if (table === 'line_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'account-1' }, error: null })
          }
        }
        if (table === 'contact_line_links') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { POST } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link', {
        method: 'POST',
        body: JSON.stringify({ line_account_id: '550e8400-e29b-41d4-a716-446655440000' })
      })
      const response = await POST(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.token).toBe('test-token-123')
      expect(body.data.linkUrl).toContain('test-token-123')
    })
  })

  describe('DELETE /api/contacts/[id]/line-link', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null }
      })

      vi.resetModules()
      const { DELETE } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link', {
        method: 'DELETE'
      })
      const response = await DELETE(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(401)
    })

    it('should return 404 when contact not found', async () => {
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { DELETE } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link', {
        method: 'DELETE'
      })
      const response = await DELETE(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(404)
    })

    it('should delete all LINE links for contact', async () => {
      const mockDelete = vi.fn().mockReturnThis()
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null })
          }
        }
        if (table === 'contact_line_links') {
          return {
            delete: mockDelete,
            eq: vi.fn().mockResolvedValue({ error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { DELETE } = await import('./route')

      const request = new Request('http://localhost/api/contacts/contact-1/line-link', {
        method: 'DELETE'
      })
      const response = await DELETE(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(200)
      expect(mockDelete).toHaveBeenCalled()
    })

    it('should delete specific LINE link with line_account_id query param', async () => {
      // Create a chainable mock that returns itself and resolves properly when awaited
      const createChainableMock = () => {
        const chainable: Record<string, unknown> = {}
        chainable.eq = vi.fn().mockReturnValue(chainable)
        // When awaited, return { error: null }
        chainable.then = (resolve: (value: { error: null }) => void) => {
          resolve({ error: null })
          return chainable
        }
        return chainable
      }

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'contacts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null })
          }
        }
        if (table === 'contact_line_links') {
          const chainable = createChainableMock()
          return {
            delete: vi.fn().mockReturnValue(chainable)
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis()
        }
      })

      vi.resetModules()
      const { DELETE } = await import('./route')

      const request = new Request(
        'http://localhost/api/contacts/contact-1/line-link?line_account_id=account-1',
        { method: 'DELETE' }
      )
      const response = await DELETE(request as never, { params: Promise.resolve({ id: 'contact-1' }) })

      expect(response.status).toBe(200)
    })
  })
})
