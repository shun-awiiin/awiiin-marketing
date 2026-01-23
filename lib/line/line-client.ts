import crypto from 'crypto'

const LINE_API_BASE = 'https://api.line.me/v2/bot'

export interface LineMessage {
  type: 'text' | 'flex' | 'template'
  text?: string
  altText?: string
  contents?: Record<string, unknown>
  template?: Record<string, unknown>
}

export class LineClient {
  private accessToken: string
  private channelSecret: string

  constructor(accessToken: string, channelSecret: string) {
    this.accessToken = accessToken
    this.channelSecret = channelSecret
  }

  // Verify webhook signature
  verifySignature(body: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.channelSecret)
      .update(body)
      .digest('base64')
    return hash === signature
  }

  // Push message to a single user
  async pushMessage(to: string, messages: LineMessage[]): Promise<void> {
    const response = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify({ to, messages })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(`LINE API Error: ${error.message || response.statusText}`)
    }
  }

  // Multicast to multiple users (max 500)
  async multicast(to: string[], messages: LineMessage[]): Promise<void> {
    const response = await fetch(`${LINE_API_BASE}/message/multicast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify({ to, messages })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(`LINE API Error: ${error.message || response.statusText}`)
    }
  }

  // Reply to a webhook event
  async replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
    const response = await fetch(`${LINE_API_BASE}/message/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify({ replyToken, messages })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(`LINE API Error: ${error.message || response.statusText}`)
    }
  }

  // Get user profile
  async getProfile(userId: string): Promise<{
    displayName: string
    userId: string
    pictureUrl?: string
    statusMessage?: string
  }> {
    const response = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get profile: ${response.statusText}`)
    }

    return response.json()
  }

  // Get bot info
  async getBotInfo(): Promise<{
    userId: string
    basicId: string
    displayName: string
    pictureUrl?: string
    chatMode: string
    markAsReadMode: string
  }> {
    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get bot info: ${response.statusText}`)
    }

    return response.json()
  }

  // Set rich menu for user
  async setRichMenu(userId: string, richMenuId: string): Promise<void> {
    const response = await fetch(
      `${LINE_API_BASE}/user/${userId}/richmenu/${richMenuId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to set rich menu: ${response.statusText}`)
    }
  }

  // Get message quota
  async getMessageQuota(): Promise<{
    type: string
    value?: number
  }> {
    const response = await fetch(`${LINE_API_BASE}/message/quota`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get quota: ${response.statusText}`)
    }

    return response.json()
  }
}

// Message builders
export function buildTextMessage(text: string): LineMessage {
  return {
    type: 'text',
    text
  }
}

export function buildFlexMessage(
  altText: string,
  contents: Record<string, unknown>
): LineMessage {
  return {
    type: 'flex',
    altText,
    contents
  }
}

export function buildTemplateMessage(
  altText: string,
  template: Record<string, unknown>
): LineMessage {
  return {
    type: 'template',
    altText,
    template
  }
}

// Button template builder
export function buildButtonTemplate(
  title: string,
  text: string,
  actions: Array<{
    type: 'uri' | 'message' | 'postback'
    label: string
    uri?: string
    text?: string
    data?: string
  }>,
  thumbnailImageUrl?: string
): Record<string, unknown> {
  return {
    type: 'buttons',
    thumbnailImageUrl,
    title,
    text,
    actions
  }
}

// Confirm template builder
export function buildConfirmTemplate(
  text: string,
  actions: [
    { type: 'message' | 'postback'; label: string; text?: string; data?: string },
    { type: 'message' | 'postback'; label: string; text?: string; data?: string }
  ]
): Record<string, unknown> {
  return {
    type: 'confirm',
    text,
    actions
  }
}
