import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  LineClient,
  buildTextMessage,
  buildFlexMessage,
  buildTemplateMessage,
  buildButtonTemplate,
  buildConfirmTemplate
} from './line-client'

describe('LineClient', () => {
  const mockAccessToken = 'test-access-token'
  const mockChannelSecret = 'test-channel-secret'
  let client: LineClient

  beforeEach(() => {
    client = new LineClient(mockAccessToken, mockChannelSecret)
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verifySignature', () => {
    it('should return true for valid signature', () => {
      const body = '{"test":"data"}'
      // Pre-computed HMAC-SHA256 of body with test-channel-secret
      const crypto = require('crypto')
      const expectedSignature = crypto
        .createHmac('sha256', mockChannelSecret)
        .update(body)
        .digest('base64')

      expect(client.verifySignature(body, expectedSignature)).toBe(true)
    })

    it('should return false for invalid signature', () => {
      const body = '{"test":"data"}'
      const invalidSignature = 'invalid-signature'

      expect(client.verifySignature(body, invalidSignature)).toBe(false)
    })

    it('should return false when body differs', () => {
      const body = '{"test":"data"}'
      const differentBody = '{"test":"different"}'
      const crypto = require('crypto')
      const signatureForDifferentBody = crypto
        .createHmac('sha256', mockChannelSecret)
        .update(differentBody)
        .digest('base64')

      expect(client.verifySignature(body, signatureForDifferentBody)).toBe(false)
    })
  })

  describe('pushMessage', () => {
    it('should send push message successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })
      global.fetch = mockFetch

      const to = 'U1234567890'
      const messages = [buildTextMessage('Hello')]

      await client.pushMessage(to, messages)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockAccessToken}`
          },
          body: JSON.stringify({ to, messages })
        })
      )
    })

    it('should throw error on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ message: 'Invalid request' })
      })
      global.fetch = mockFetch

      await expect(client.pushMessage('U123', [buildTextMessage('Test')]))
        .rejects.toThrow('LINE API Error: Invalid request')
    })

    it('should handle JSON parse error in error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Parse error'))
      })
      global.fetch = mockFetch

      await expect(client.pushMessage('U123', [buildTextMessage('Test')]))
        .rejects.toThrow('LINE API Error: Internal Server Error')
    })
  })

  describe('multicast', () => {
    it('should send multicast message successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })
      global.fetch = mockFetch

      const to = ['U1234567890', 'U0987654321']
      const messages = [buildTextMessage('Broadcast')]

      await client.multicast(to, messages)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/multicast',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ to, messages })
        })
      )
    })

    it('should throw error on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ message: 'Permission denied' })
      })
      global.fetch = mockFetch

      await expect(client.multicast(['U123'], [buildTextMessage('Test')]))
        .rejects.toThrow('LINE API Error: Permission denied')
    })
  })

  describe('replyMessage', () => {
    it('should send reply message successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })
      global.fetch = mockFetch

      const replyToken = 'reply-token-123'
      const messages = [buildTextMessage('Reply')]

      await client.replyMessage(replyToken, messages)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ replyToken, messages })
        })
      )
    })
  })

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      const mockProfile = {
        displayName: 'Test User',
        userId: 'U1234567890',
        pictureUrl: 'https://example.com/picture.jpg',
        statusMessage: 'Hello World'
      }
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      })
      global.fetch = mockFetch

      const result = await client.getProfile('U1234567890')

      expect(result).toEqual(mockProfile)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/profile/U1234567890',
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockAccessToken}`
          }
        })
      )
    })

    it('should throw error when profile not found', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      })
      global.fetch = mockFetch

      await expect(client.getProfile('U123'))
        .rejects.toThrow('Failed to get profile: Not Found')
    })
  })

  describe('getBotInfo', () => {
    it('should get bot info successfully', async () => {
      const mockBotInfo = {
        userId: 'Ubot123',
        basicId: '@bot123',
        displayName: 'My Bot',
        pictureUrl: 'https://example.com/bot.jpg',
        chatMode: 'chat',
        markAsReadMode: 'auto'
      }
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBotInfo)
      })
      global.fetch = mockFetch

      const result = await client.getBotInfo()

      expect(result).toEqual(mockBotInfo)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/info',
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockAccessToken}`
          }
        })
      )
    })
  })

  describe('setRichMenu', () => {
    it('should set rich menu successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true
      })
      global.fetch = mockFetch

      await client.setRichMenu('U123', 'richmenu-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/user/U123/richmenu/richmenu-123',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })
  })

  describe('getMessageQuota', () => {
    it('should get message quota successfully', async () => {
      const mockQuota = { type: 'limited', value: 1000 }
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQuota)
      })
      global.fetch = mockFetch

      const result = await client.getMessageQuota()

      expect(result).toEqual(mockQuota)
    })
  })
})

describe('Message Builders', () => {
  describe('buildTextMessage', () => {
    it('should build text message', () => {
      const message = buildTextMessage('Hello World')
      expect(message).toEqual({
        type: 'text',
        text: 'Hello World'
      })
    })
  })

  describe('buildFlexMessage', () => {
    it('should build flex message', () => {
      const contents = { type: 'bubble', body: { type: 'box' } }
      const message = buildFlexMessage('Alt text', contents)
      expect(message).toEqual({
        type: 'flex',
        altText: 'Alt text',
        contents
      })
    })
  })

  describe('buildTemplateMessage', () => {
    it('should build template message', () => {
      const template = { type: 'buttons', text: 'Click' }
      const message = buildTemplateMessage('Alt text', template)
      expect(message).toEqual({
        type: 'template',
        altText: 'Alt text',
        template
      })
    })
  })

  describe('buildButtonTemplate', () => {
    it('should build button template', () => {
      const actions = [
        { type: 'uri' as const, label: 'Visit', uri: 'https://example.com' }
      ]
      const template = buildButtonTemplate('Title', 'Text', actions, 'https://example.com/thumb.jpg')

      expect(template).toEqual({
        type: 'buttons',
        thumbnailImageUrl: 'https://example.com/thumb.jpg',
        title: 'Title',
        text: 'Text',
        actions
      })
    })

    it('should build button template without thumbnail', () => {
      const actions = [
        { type: 'message' as const, label: 'Say Hi', text: 'Hi' }
      ]
      const template = buildButtonTemplate('Title', 'Text', actions)

      expect(template).toEqual({
        type: 'buttons',
        thumbnailImageUrl: undefined,
        title: 'Title',
        text: 'Text',
        actions
      })
    })
  })

  describe('buildConfirmTemplate', () => {
    it('should build confirm template', () => {
      const actions: [
        { type: 'message'; label: string; text: string },
        { type: 'message'; label: string; text: string }
      ] = [
        { type: 'message', label: 'Yes', text: 'yes' },
        { type: 'message', label: 'No', text: 'no' }
      ]
      const template = buildConfirmTemplate('Are you sure?', actions)

      expect(template).toEqual({
        type: 'confirm',
        text: 'Are you sure?',
        actions
      })
    })
  })
})
