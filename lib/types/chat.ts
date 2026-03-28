export type ConversationStatus = 'open' | 'assigned' | 'resolved' | 'closed'
export type MessageRole = 'visitor' | 'agent' | 'system'

export interface ChatWidget {
  id: string
  user_id: string
  name: string
  settings: {
    position: 'bottom-right' | 'bottom-left'
    primaryColor: string
    greeting: string
    placeholder: string
    offlineMessage: string
    requireEmail: boolean
  }
  allowed_domains: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChatConversation {
  id: string
  widget_id: string
  visitor_id: string
  contact_id: string | null
  assigned_to: string | null
  status: ConversationStatus
  subject: string | null
  started_at: string
  resolved_at: string | null
  created_at: string
  visitor?: ChatVisitor
  messages?: ChatMessage[]
}

export interface ChatVisitor {
  id: string
  widget_id: string
  contact_id: string | null
  email: string | null
  name: string | null
}

export interface ChatMessage {
  id: string
  conversation_id: string
  role: MessageRole
  sender_id: string | null
  content: string
  read_at: string | null
  created_at: string
}
