import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactDetailHeader } from '@/components/contacts/contact-detail-header'
import { ContactTimeline } from '@/components/contacts/contact-timeline'
import { ContactNotes } from '@/components/contacts/contact-notes'
import type { ContactWithTags } from '@/lib/types/database'
import type { ContactActivity, ContactNote } from '@/lib/types/timeline'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

const TIMELINE_PER_PAGE = 20

export default async function ContactDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // Fetch contact
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (contactError || !contact) {
    notFound()
  }

  // Fetch tags, timeline, and notes in parallel
  const [tagsResult, timelineResult, notesResult] = await Promise.all([
    supabase
      .from('contact_tags')
      .select('tags(*)')
      .eq('contact_id', id),
    supabase
      .from('contact_activities')
      .select('*', { count: 'exact' })
      .eq('contact_id', id)
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .range(0, TIMELINE_PER_PAGE - 1),
    supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const tags = (tagsResult.data?.map((ct) => ct.tags).filter(Boolean) || []) as unknown as ContactWithTags['tags']
  const contactWithTags: ContactWithTags = { ...contact, tags }

  const activities: ContactActivity[] = (timelineResult.data || []) as ContactActivity[]
  const totalActivities = timelineResult.count || 0
  const hasMore = TIMELINE_PER_PAGE < totalActivities

  const notes: ContactNote[] = (notesResult.data || []) as ContactNote[]

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Back link */}
      <Link href="/dashboard/contacts">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          コンタクト一覧に戻る
        </Button>
      </Link>

      {/* Header */}
      <ContactDetailHeader contact={contactWithTags} />

      {/* Timeline + Notes in 2-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ContactTimeline
            contactId={id}
            initialActivities={activities}
            initialHasMore={hasMore}
          />
        </div>
        <div>
          <ContactNotes
            contactId={id}
            initialNotes={notes}
          />
        </div>
      </div>
    </div>
  )
}
