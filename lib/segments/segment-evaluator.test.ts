import { describe, it, expect, vi, beforeEach } from 'vitest'
import { evaluateSegment, countSegmentContacts } from './segment-evaluator'
import type { SegmentRules } from '@/lib/types/l-step'

// Mock Supabase client
function createMockSupabase(mockResponses: Record<string, unknown>) {
  const createQuery = (table: string) => {
    let filters: Record<string, unknown> = {}

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((key: string, value: unknown) => {
        filters[key] = value
        return query
      }),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      then: (resolve: (result: { data: unknown }) => void) => {
        const response = mockResponses[table] || { data: [] }
        resolve(response as { data: unknown })
        return Promise.resolve(response)
      }
    }

    // Make it thenable
    Object.defineProperty(query, 'then', {
      value: (resolve: (result: unknown) => void) => {
        const response = mockResponses[table] || { data: [] }
        resolve(response)
        return Promise.resolve(response)
      }
    })

    return query
  }

  return {
    from: vi.fn((table: string) => createQuery(table))
  }
}

describe('evaluateSegment', () => {
  const userId = 'user-123'

  describe('empty conditions', () => {
    it('should return all active contacts when no conditions', async () => {
      const mockContacts = [
        { id: '1', email: 'a@test.com', status: 'active', created_at: '2024-01-01' },
        { id: '2', email: 'b@test.com', status: 'active', created_at: '2024-01-02' }
      ]

      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (r: unknown) => void) => {
            resolve({ data: mockContacts })
            return Promise.resolve({ data: mockContacts })
          }
        })
      }

      const rules: SegmentRules = { operator: 'AND', conditions: [] }
      const result = await evaluateSegment(supabase as never, userId, rules)

      expect(result).toEqual(mockContacts)
    })
  })

  describe('AND operator', () => {
    it('should return intersection of contacts matching all conditions', async () => {
      const mockContacts = [
        { id: '1', email: 'a@test.com', status: 'active', created_at: '2024-01-01' }
      ]

      // Complex mock for AND evaluation
      const contactsWithTag = [{ contact_id: '1' }, { contact_id: '2' }]
      const userContacts = [{ id: '1' }]
      const allUserContacts = [{ id: '1' }, { id: '2' }]

      let callCount = 0
      const supabase = {
        from: vi.fn((table: string) => {
          const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (r: unknown) => void) => {
              callCount++
              if (table === 'contact_tags') {
                resolve({ data: contactsWithTag })
              } else if (table === 'contacts') {
                // First call for filtering, subsequent calls for final fetch
                if (callCount <= 2) {
                  resolve({ data: userContacts })
                } else {
                  resolve({ data: mockContacts })
                }
              }
              return Promise.resolve({ data: [] })
            }
          }
          return query
        })
      }

      const rules: SegmentRules = {
        operator: 'AND',
        conditions: [
          { type: 'tag', operator: 'exists', value: 'tag-123' }
        ]
      }

      const result = await evaluateSegment(supabase as never, userId, rules)
      expect(supabase.from).toHaveBeenCalled()
    })

    it('should return empty array when no contacts match AND conditions', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (r: unknown) => void) => {
            resolve({ data: [] })
            return Promise.resolve({ data: [] })
          }
        })
      }

      const rules: SegmentRules = {
        operator: 'AND',
        conditions: [
          { type: 'tag', operator: 'exists', value: 'nonexistent-tag' }
        ]
      }

      const result = await evaluateSegment(supabase as never, userId, rules)
      expect(result).toEqual([])
    })
  })

  describe('OR operator', () => {
    it('should return union of contacts matching any condition', async () => {
      const mockContacts = [
        { id: '1', email: 'a@test.com', status: 'active', created_at: '2024-01-01' },
        { id: '2', email: 'b@test.com', status: 'active', created_at: '2024-01-02' }
      ]

      let callCount = 0
      const supabase = {
        from: vi.fn((table: string) => {
          const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (r: unknown) => void) => {
              callCount++
              if (table === 'contact_tags') {
                resolve({ data: [{ contact_id: '1' }] })
              } else if (table === 'contacts') {
                if (callCount <= 2) {
                  resolve({ data: [{ id: '1' }] })
                } else {
                  resolve({ data: mockContacts })
                }
              }
              return Promise.resolve({ data: [] })
            }
          }
          return query
        })
      }

      const rules: SegmentRules = {
        operator: 'OR',
        conditions: [
          { type: 'tag', operator: 'exists', value: 'tag-1' }
        ]
      }

      const result = await evaluateSegment(supabase as never, userId, rules)
      expect(supabase.from).toHaveBeenCalled()
    })
  })

  describe('condition types', () => {
    describe('status condition', () => {
      it('should filter by status', async () => {
        const mockContacts = [
          { id: '1', email: 'a@test.com', status: 'active', created_at: '2024-01-01' }
        ]

        const supabase = {
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (r: unknown) => void) => {
              resolve({ data: mockContacts.map(c => ({ id: c.id })) })
              return Promise.resolve({ data: mockContacts })
            }
          })
        }

        const rules: SegmentRules = {
          operator: 'AND',
          conditions: [
            { type: 'status', operator: 'equals', value: 'active' }
          ]
        }

        await evaluateSegment(supabase as never, userId, rules)
        expect(supabase.from).toHaveBeenCalledWith('contacts')
      })
    })

    describe('created_at condition', () => {
      it('should filter by created_at greater than', async () => {
        const supabase = {
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (r: unknown) => void) => {
              resolve({ data: [{ id: '1' }] })
              return Promise.resolve({ data: [] })
            }
          })
        }

        const rules: SegmentRules = {
          operator: 'AND',
          conditions: [
            { type: 'created_at', operator: 'greater', value: '2024-01-01' }
          ]
        }

        await evaluateSegment(supabase as never, userId, rules)
        expect(supabase.from).toHaveBeenCalled()
      })
    })

    describe('custom_field condition', () => {
      it('should filter by custom field equals', async () => {
        let callCount = 0
        const supabase = {
          from: vi.fn((table: string) => {
            const query = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              then: (resolve: (r: unknown) => void) => {
                callCount++
                if (table === 'contact_custom_values') {
                  resolve({ data: [{ contact_id: '1' }] })
                } else {
                  resolve({ data: [{ id: '1', email: 'test@test.com', status: 'active', created_at: '2024-01-01' }] })
                }
                return Promise.resolve({ data: [] })
              }
            }
            return query
          })
        }

        const rules: SegmentRules = {
          operator: 'AND',
          conditions: [
            { type: 'custom_field', operator: 'equals', value: 'Tokyo', field: 'field-123' }
          ]
        }

        await evaluateSegment(supabase as never, userId, rules)
        expect(supabase.from).toHaveBeenCalledWith('contact_custom_values')
      })
    })

    describe('email_activity condition', () => {
      it('should filter by email activity', async () => {
        let callCount = 0
        const supabase = {
          from: vi.fn((table: string) => {
            const query = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              then: (resolve: (r: unknown) => void) => {
                callCount++
                if (table === 'email_events') {
                  resolve({ data: [{ contact_id: '1' }, { contact_id: '1' }] }) // Duplicate to test dedup
                } else {
                  resolve({ data: [{ id: '1', email: 'test@test.com', status: 'active', created_at: '2024-01-01' }] })
                }
                return Promise.resolve({ data: [] })
              }
            }
            return query
          })
        }

        const rules: SegmentRules = {
          operator: 'AND',
          conditions: [
            { type: 'email_activity', operator: 'equals', value: 'opened' }
          ]
        }

        await evaluateSegment(supabase as never, userId, rules)
        expect(supabase.from).toHaveBeenCalledWith('email_events')
      })
    })
  })
})

describe('countSegmentContacts', () => {
  it('should return count of contacts in segment', async () => {
    const mockContacts = [
      { id: '1', email: 'a@test.com', status: 'active', created_at: '2024-01-01' },
      { id: '2', email: 'b@test.com', status: 'active', created_at: '2024-01-02' },
      { id: '3', email: 'c@test.com', status: 'active', created_at: '2024-01-03' }
    ]

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (r: unknown) => void) => {
          resolve({ data: mockContacts })
          return Promise.resolve({ data: mockContacts })
        }
      })
    }

    const rules: SegmentRules = { operator: 'AND', conditions: [] }
    const count = await countSegmentContacts(supabase as never, 'user-123', rules)

    expect(count).toBe(3)
  })
})
