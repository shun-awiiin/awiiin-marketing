import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateLinkToken,
  isTokenValid,
  isTokenExpired,
  verifyToken,
  createLinkToken,
  consumeToken,
  cleanupExpiredTokens
} from './line-linker'

describe('line-linker', () => {
  describe('generateLinkToken', () => {
    it('should return a 64-character hex string', () => {
      const token = generateLinkToken()
      expect(token).toHaveLength(64)
      expect(/^[0-9a-f]+$/.test(token)).toBe(true)
    })

    it('should generate unique tokens', () => {
      const token1 = generateLinkToken()
      const token2 = generateLinkToken()
      expect(token1).not.toBe(token2)
    })
  })

  describe('isTokenValid', () => {
    it('should return true for tokens under 24 hours old', () => {
      const createdAt = new Date(Date.now() - 23 * 60 * 60 * 1000) // 23 hours ago
      expect(isTokenValid(createdAt)).toBe(true)
    })

    it('should return true for recently created tokens', () => {
      const createdAt = new Date() // Just now
      expect(isTokenValid(createdAt)).toBe(true)
    })

    it('should return false for tokens 24 hours or older', () => {
      const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000) // Exactly 24 hours ago
      expect(isTokenValid(createdAt)).toBe(false)
    })

    it('should return false for tokens more than 24 hours old', () => {
      const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      expect(isTokenValid(createdAt)).toBe(false)
    })
  })

  describe('isTokenExpired', () => {
    it('should return false for future expiry', () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      expect(isTokenExpired(expiresAt)).toBe(false)
    })

    it('should return true for past expiry', () => {
      const expiresAt = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      expect(isTokenExpired(expiresAt)).toBe(true)
    })

    it('should return true for exact current time', () => {
      const expiresAt = new Date()
      expect(isTokenExpired(expiresAt)).toBe(true)
    })
  })

  describe('verifyToken', () => {
    function createMockSupabase(data: unknown, error: unknown = null) {
      return {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data, error })
        })
      }
    }

    it('should return token data for valid token', async () => {
      const tokenData = {
        id: 'token-1',
        token: 'abc123',
        contact_id: 'contact-1',
        line_account_id: 'account-1',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        used_at: null,
        created_at: new Date().toISOString()
      }
      const supabase = createMockSupabase(tokenData)

      const result = await verifyToken('abc123', supabase as never)
      expect(result).toEqual(tokenData)
    })

    it('should return null for non-existent token', async () => {
      const supabase = createMockSupabase(null, { message: 'Not found' })

      const result = await verifyToken('nonexistent', supabase as never)
      expect(result).toBeNull()
    })

    it('should return null for expired token', async () => {
      const tokenData = {
        id: 'token-1',
        token: 'expired123',
        contact_id: 'contact-1',
        line_account_id: 'account-1',
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Expired
        used_at: null,
        created_at: new Date().toISOString()
      }
      const supabase = createMockSupabase(tokenData)

      const result = await verifyToken('expired123', supabase as never)
      expect(result).toBeNull()
    })

    it('should return null when database error occurs', async () => {
      const supabase = createMockSupabase(null, { message: 'Database error' })

      const result = await verifyToken('abc123', supabase as never)
      expect(result).toBeNull()
    })
  })

  describe('createLinkToken', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com')
    })

    it('should create a link token and return URL', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null })
      const supabase = {
        from: vi.fn().mockReturnValue({
          insert: mockInsert
        })
      }

      const result = await createLinkToken(
        supabase as never,
        'contact-1',
        'account-1'
      )

      expect(result.token).toHaveLength(64)
      expect(result.linkUrl).toContain('https://example.com/line/link?token=')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'contact-1',
          line_account_id: 'account-1'
        })
      )
    })

    it('should throw error when insert fails', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({ error: { message: 'Insert failed' } })
        })
      }

      await expect(
        createLinkToken(supabase as never, 'contact-1', 'account-1')
      ).rejects.toThrow('Failed to create link token: Insert failed')
    })
  })

  describe('consumeToken', () => {
    function createMockSupabase(tokenData: unknown, updateSuccess = true, upsertSuccess = true) {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: updateSuccess ? null : { message: 'Update failed' } })
      })

      const mockUpsert = vi.fn().mockResolvedValue({
        error: upsertSuccess ? null : { message: 'Upsert failed' }
      })

      return {
        from: vi.fn((table: string) => {
          if (table === 'link_tokens') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: tokenData, error: null }),
              update: mockUpdate
            }
          }
          if (table === 'contact_line_links') {
            return {
              upsert: mockUpsert
            }
          }
          return {}
        }),
        mockUpdate,
        mockUpsert
      }
    }

    it('should return false for invalid token', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
        })
      }

      const result = await consumeToken(supabase as never, 'invalid', 'U123')
      expect(result).toBe(false)
    })

    it('should consume token and create link successfully', async () => {
      const tokenData = {
        id: 'token-1',
        token: 'valid123',
        contact_id: 'contact-1',
        line_account_id: 'account-1',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        used_at: null
      }
      const supabase = createMockSupabase(tokenData, true, true)

      const result = await consumeToken(
        supabase as never,
        'valid123',
        'U123456',
        'Test User',
        'https://example.com/pic.jpg'
      )

      expect(result).toBe(true)
      expect(supabase.mockUpdate).toHaveBeenCalled()
      expect(supabase.mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'contact-1',
          line_user_id: 'U123456',
          display_name: 'Test User'
        }),
        expect.any(Object)
      )
    })

    it('should return false when token update fails', async () => {
      const tokenData = {
        id: 'token-1',
        token: 'valid123',
        contact_id: 'contact-1',
        line_account_id: 'account-1',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        used_at: null
      }
      const supabase = createMockSupabase(tokenData, false, true)

      const result = await consumeToken(supabase as never, 'valid123', 'U123456')
      expect(result).toBe(false)
    })
  })

  describe('cleanupExpiredTokens', () => {
    it('should return count of deleted tokens', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({
            data: [{ id: '1' }, { id: '2' }, { id: '3' }],
            error: null
          })
        })
      }

      const count = await cleanupExpiredTokens(supabase as never)
      expect(count).toBe(3)
    })

    it('should return 0 when no tokens deleted', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      }

      const count = await cleanupExpiredTokens(supabase as never)
      expect(count).toBe(0)
    })

    it('should return 0 on error', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } })
        })
      }

      const count = await cleanupExpiredTokens(supabase as never)
      expect(count).toBe(0)
    })
  })
})
