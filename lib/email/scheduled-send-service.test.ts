/**
 * Scheduled Send Service - Tests
 * TDD: RED phase - Write tests first
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  findScheduledCampaigns,
  processScheduledCampaign,
  markCampaignAsProcessing,
  ScheduledSendError,
} from './scheduled-send-service';

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(mockSupabaseClient),
}));

// Mock fetch for queue endpoint
global.fetch = vi.fn();

describe('Scheduled Send Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('findScheduledCampaigns', () => {
    it('should find campaigns due for sending', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Test Campaign',
          scheduled_at: '2024-01-15T09:30:00Z',
          status: 'scheduled',
        },
        {
          id: 'campaign-2',
          name: 'Another Campaign',
          scheduled_at: '2024-01-15T09:45:00Z',
          status: 'scheduled',
        },
      ];

      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.lte.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: mockCampaigns,
        error: null,
      });

      const campaigns = await findScheduledCampaigns();

      expect(campaigns).toHaveLength(2);
      expect(campaigns[0].id).toBe('campaign-1');
    });

    it('should return empty array when no campaigns are due', async () => {
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const campaigns = await findScheduledCampaigns();
      expect(campaigns).toHaveLength(0);
    });

    it('should only find campaigns with scheduled status', async () => {
      mockSupabaseClient.eq.mockReturnThis();

      await findScheduledCampaigns();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('campaigns');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('status', 'scheduled');
    });

    it('should limit to 10 campaigns per batch', async () => {
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await findScheduledCampaigns();

      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('markCampaignAsProcessing', () => {
    it('should update campaign status to queued', async () => {
      mockSupabaseClient.update.mockReturnThis();
      mockSupabaseClient.eq.mockResolvedValueOnce({
        data: { id: 'campaign-1', status: 'queued' },
        error: null,
      });

      await markCampaignAsProcessing('campaign-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('campaigns');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        status: 'queued',
        started_at: expect.any(String),
      });
    });

    it('should throw error if update fails', async () => {
      mockSupabaseClient.update.mockReturnThis();
      mockSupabaseClient.eq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(markCampaignAsProcessing('campaign-1')).rejects.toThrow(
        ScheduledSendError
      );
    });
  });

  describe('processScheduledCampaign', () => {
    it('should queue campaign for sending', async () => {
      // Mock status update
      mockSupabaseClient.update.mockReturnThis();
      mockSupabaseClient.eq.mockResolvedValueOnce({
        data: { id: 'campaign-1' },
        error: null,
      });

      // Mock queue API call
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { total_messages: 100 },
          }),
      });

      const result = await processScheduledCampaign({
        id: 'campaign-1',
        name: 'Test Campaign',
        scheduled_at: '2024-01-15T09:30:00Z',
        status: 'scheduled',
        user_id: 'user-1',
        template_id: 'template-1',
      });

      expect(result.status).toBe('success');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaigns/campaign-1/queue'),
        expect.any(Object)
      );
    });

    it('should handle queue API failure', async () => {
      mockSupabaseClient.update.mockReturnThis();
      mockSupabaseClient.eq.mockResolvedValueOnce({
        data: { id: 'campaign-1' },
        error: null,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Queue failed',
          }),
      });

      const result = await processScheduledCampaign({
        id: 'campaign-1',
        name: 'Test Campaign',
        scheduled_at: '2024-01-15T09:30:00Z',
        status: 'scheduled',
        user_id: 'user-1',
        template_id: 'template-1',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('ScheduledSendError', () => {
    it('should have correct error code', () => {
      const error = new ScheduledSendError('Processing failed', 'PROCESS_FAILED');
      expect(error.code).toBe('PROCESS_FAILED');
      expect(error.message).toBe('Processing failed');
    });
  });
});
