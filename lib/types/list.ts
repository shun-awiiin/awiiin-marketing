// Static List Types

export interface List {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  contact_count: number
  created_at: string
  updated_at: string
}

export interface ListContact {
  list_id: string
  contact_id: string
  added_at: string
}

export interface ListWithContacts extends List {
  contacts: Array<{
    id: string
    email: string
    first_name: string | null
    company: string | null
    status: string
    created_at: string
  }>
}

export interface CreateListRequest {
  name: string
  description?: string
  color?: string
}

export interface UpdateListRequest {
  name?: string
  description?: string
  color?: string
}

export interface AddContactsToListRequest {
  contact_ids: string[]
}

export interface RemoveContactsFromListRequest {
  contact_ids: string[]
}
