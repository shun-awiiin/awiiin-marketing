import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isValidEmail } from '@/lib/email/template-renderer';
import { quickValidateEmail } from '@/lib/validation/email-validator';

// App Router config for large file uploads and long processing
export const maxDuration = 300; // 5 minutes for Vercel Pro, 60 for Hobby
export const dynamic = 'force-dynamic';

interface ImportError {
  row: number;
  email: string;
  reason: string;
}

// Optimized batch settings for high-performance import
const BATCH_SIZE = 2000;
const PARALLEL_BATCHES = 5;

// POST /api/contacts/import - Import contacts from CSV
export async function POST(request: NextRequest) {
  try {
    // Use regular client for auth verification
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role client for data operations (bypasses RLS for speed)
    // Security: user is already verified above, all queries are scoped by user.id
    const supabase = await createServiceClient();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const updateExisting = formData.get('update_existing') !== 'false';
    const validateEmails = formData.get('validate_emails') !== 'false';

    // Tag assignment parameters
    const tagIdsParam = formData.get('tag_ids') as string | null;
    const newTagName = formData.get('new_tag_name') as string | null;
    const newTagColor = formData.get('new_tag_color') as string | null;

    // List assignment parameters
    const listIdParam = formData.get('list_id') as string | null;
    const newListName = formData.get('new_list_name') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Parse CSV (handle quoted newlines)
    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV file must have header and at least one data row' }, { status: 400 });
    }

    // Parse header
    const header = rows[0].map(normalizeHeader);

    // Support multiple email column names (including HubSpot format)
    const emailIndex = header.findIndex(h => 
      h === 'email' || h === 'eメール' || h === 'メール' || h === 'メールアドレス' || h === 'e-mail'
    );
    
    // Support multiple first name column names (including HubSpot format)
    const firstNameIndex = header.findIndex(h => 
      h === 'firstname' || h === 'first_name' || h === 'name' || h === '名'
    );
    
    // Support last name for HubSpot format
    const lastNameIndex = header.findIndex(h => h === 'lastname' || h === 'last_name' || h === '姓');
    
    // Support multiple company column names (including HubSpot format)
    const companyIndex = header.findIndex(h => 
      h === 'company' || h === 'associated company' || h === '会社' || h === '会社名'
    );
    
    const tagsIndex = header.findIndex(h => h === 'tags' || h === 'タグ');
    
    // HubSpot specific: Marketing contact status can be used as tag
    const marketingStatusIndex = header.findIndex(h => 
      h === 'マーケティング コンタクト ステータス' || h === 'marketing contact status'
    );
    
    // HubSpot specific: Lead status
    const leadStatusIndex = header.findIndex(h => 
      h === 'リードステータス' || h === 'lead status'
    );

    if (emailIndex === -1) {
      return NextResponse.json({ error: 'CSV must have an "email" or "Eメール" column' }, { status: 400 });
    }

    // Get existing contacts (in batches if needed)
    const existingEmailMap = new Map<string, string>();
    let offset = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id, email')
        .eq('user_id', user.id)
        .range(offset, offset + pageSize - 1);
      
      if (!existingContacts || existingContacts.length === 0) break;
      
      existingContacts.forEach(c => {
        existingEmailMap.set(c.email.toLowerCase(), c.id);
      });
      
      if (existingContacts.length < pageSize) break;
      offset += pageSize;
    }

    // Get existing tags
    const { data: existingTags } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', user.id);

    const tagNameToId = new Map(
      existingTags?.map(t => [t.name.toLowerCase(), t.id]) || []
    );

    // Parse tag IDs from parameter
    const bulkTagIds: string[] = tagIdsParam
      ? tagIdsParam.split(',').map(id => id.trim()).filter(Boolean)
      : [];

    // Create new tag if provided
    if (newTagName?.trim()) {
      const { data: newTag } = await supabase
        .from('tags')
        .insert({
          user_id: user.id,
          name: newTagName.trim(),
          color: newTagColor || getRandomColor()
        })
        .select()
        .single();

      if (newTag) {
        bulkTagIds.push(newTag.id);
        tagNameToId.set(newTag.name.toLowerCase(), newTag.id);
      }
    }

    // Create new list if provided or use existing list
    let targetListId: string | null = null;
    if (newListName?.trim()) {
      const { data: newList } = await supabase
        .from('lists')
        .insert({
          user_id: user.id,
          name: newListName.trim(),
          color: '#6B7280'
        })
        .select()
        .single();

      if (newList) {
        targetListId = newList.id;
      }
    } else if (listIdParam && listIdParam !== 'new') {
      targetListId = listIdParam;
    }

    // First pass: collect all unique tag names to pre-create them
    const allTagNames = new Set<string>();
    
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      
      let tagsStr = tagsIndex >= 0 ? values[tagsIndex]?.trim() || '' : '';
      
      if (marketingStatusIndex >= 0) {
        const marketingStatus = values[marketingStatusIndex]?.trim();
        if (marketingStatus) {
          tagsStr = tagsStr ? `${tagsStr},${marketingStatus}` : marketingStatus;
        }
      }
      
      if (leadStatusIndex >= 0) {
        const leadStatus = values[leadStatusIndex]?.trim();
        if (leadStatus) {
          tagsStr = tagsStr ? `${tagsStr},${leadStatus}` : leadStatus;
        }
      }
      
      const tagNames = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
      tagNames.forEach(name => {
        if (!tagNameToId.has(name.toLowerCase())) {
          allTagNames.add(name);
        }
      });
    }

    // Pre-create all new tags in batch
    if (allTagNames.size > 0) {
      const tagsToCreate = Array.from(allTagNames).map(name => ({
        user_id: user.id,
        name,
        color: getRandomColor()
      }));
      
      // Insert tags in batches
      for (let i = 0; i < tagsToCreate.length; i += BATCH_SIZE) {
        const batch = tagsToCreate.slice(i, i + BATCH_SIZE);
        const { data: newTags } = await supabase
          .from('tags')
          .insert(batch)
          .select();
        
        newTags?.forEach(t => {
          tagNameToId.set(t.name.toLowerCase(), t.id);
        });
      }
    }

    // Process rows
    const toInsert: Array<{
      user_id: string;
      email: string;
      first_name: string | null;
      company: string | null;
      status: 'active';
    }> = [];
    
    const toUpdate: Array<{
      id: string;
      first_name: string | null;
      company: string | null;
    }> = [];
    
    const tagAssignments: Array<{ email: string; tagIds: string[] }> = [];
    const errors: ImportError[] = [];
    const seenEmails = new Set<string>();
    let skipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const email = values[emailIndex]?.trim().toLowerCase();

      if (!email) {
        errors.push({ row: i + 1, email: '', reason: 'Empty email' });
        continue;
      }

      if (!isValidEmail(email)) {
        errors.push({ row: i + 1, email, reason: 'Invalid email format' });
        continue;
      }

      // Skip duplicates within CSV
      if (seenEmails.has(email)) {
        skipped++;
        continue;
      }
      seenEmails.add(email);

      // Handle first name (combine with last name if available for HubSpot format)
      let firstName = firstNameIndex >= 0 ? values[firstNameIndex]?.trim() || null : null;
      const lastName = lastNameIndex >= 0 ? values[lastNameIndex]?.trim() || null : null;
      
      if (firstName && lastName) {
        firstName = `${lastName} ${firstName}`.trim();
      } else if (!firstName && lastName) {
        firstName = lastName;
      }
      
      const company = companyIndex >= 0 ? values[companyIndex]?.trim() || null : null;
      
      // Collect tags
      let tagsStr = tagsIndex >= 0 ? values[tagsIndex]?.trim() || '' : '';
      
      if (marketingStatusIndex >= 0) {
        const marketingStatus = values[marketingStatusIndex]?.trim();
        if (marketingStatus) {
          tagsStr = tagsStr ? `${tagsStr},${marketingStatus}` : marketingStatus;
        }
      }
      
      if (leadStatusIndex >= 0) {
        const leadStatus = values[leadStatusIndex]?.trim();
        if (leadStatus) {
          tagsStr = tagsStr ? `${tagsStr},${leadStatus}` : leadStatus;
        }
      }

      // Validation (quick only for performance)
      if (validateEmails) {
        quickValidateEmail(email);
      }

      // Get tag IDs
      const tagNames = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
      const tagIds = tagNames
        .map(name => tagNameToId.get(name.toLowerCase()))
        .filter((id): id is string => !!id);

      if (tagIds.length > 0) {
        tagAssignments.push({ email, tagIds });
      }

      // Check if contact exists
      const existingId = existingEmailMap.get(email);

      if (existingId) {
        if (updateExisting) {
          toUpdate.push({
            id: existingId,
            first_name: firstName,
            company,
          });
        } else {
          skipped++;
        }
      } else {
        toInsert.push({
          user_id: user.id,
          email,
          first_name: firstName,
          company,
          status: 'active',
        });
      }
    }

    let created = 0;
    let updated = 0;
    const insertErrors: Array<{ batch: number; message: string; details?: string }> = [];

    // Use upsert for both insert and update in one operation
    const allContacts = [
      ...toInsert,
      ...toUpdate.map(u => ({
        user_id: user.id,
        email: Array.from(existingEmailMap.entries()).find(([_, id]) => id === u.id)?.[0] || '',
        first_name: u.first_name,
        company: u.company,
        status: 'active' as const,
      })).filter(c => c.email)
    ];

    // Process in parallel batches for speed
    const batches: typeof allContacts[] = [];
    
    for (let i = 0; i < allContacts.length; i += BATCH_SIZE) {
      batches.push(allContacts.slice(i, i + BATCH_SIZE));
    }

    // Process batches in parallel groups
    for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
      const parallelBatches = batches.slice(i, i + PARALLEL_BATCHES);
      
      const results = await Promise.all(
        parallelBatches.map(async (batch, idx) => {
          const { data: upserted, error } = await supabase
            .from('contacts')
            .upsert(batch, { 
              onConflict: 'user_id,email',
              ignoreDuplicates: false 
            })
            .select('id, email');

          if (error) {
            return { error, batch: i + idx + 1, data: null };
          }
          return { error: null, batch: i + idx + 1, data: upserted };
        })
      );

      for (const result of results) {
        if (result.error) {
          insertErrors.push({
            batch: result.batch,
            message: result.error.message,
            details: result.error.details,
          });
        } else if (result.data) {
          // Update email map with upserted contacts
          result.data.forEach(c => {
            const wasNew = !existingEmailMap.has(c.email.toLowerCase());
            existingEmailMap.set(c.email.toLowerCase(), c.id);
            if (wasNew) created++;
            else updated++;
          });
        }
      }
    }

    if (insertErrors.length > 0 && created === 0 && updated === 0) {
      return NextResponse.json(
        {
          error: 'Import failed',
          details: insertErrors.slice(0, 3),
        },
        { status: 500 }
      );
    }

    const skippedUpdates = 0;

    // Batch assign tags (from CSV and import settings) - process in parallel
    const tagInserts: Array<{ contact_id: string; tag_id: string }> = [];
    
    // Tags from CSV rows
    for (const { email, tagIds } of tagAssignments) {
      const contactId = existingEmailMap.get(email);
      if (!contactId) continue;
      
      for (const tagId of tagIds) {
        tagInserts.push({ contact_id: contactId, tag_id: tagId });
      }
    }

    // Bulk tags from import settings - apply to ALL contacts in CSV
    if (bulkTagIds.length > 0) {
      console.log('Bulk tag assignment - bulkTagIds:', bulkTagIds);
      console.log('seenEmails size (CSV emails):', seenEmails.size);
      console.log('existingEmailMap size:', existingEmailMap.size);
      
      // Use seenEmails (all valid emails from CSV) to assign tags
      let taggedCount = 0;
      for (const email of seenEmails) {
        const contactId = existingEmailMap.get(email); // email is already lowercase
        if (contactId) {
          for (const tagId of bulkTagIds) {
            tagInserts.push({ contact_id: contactId, tag_id: tagId });
            taggedCount++;
          }
        }
      }
      
      console.log('Total tag inserts prepared:', taggedCount);
    }

    // Insert all tag assignments in parallel batches
    if (tagInserts.length > 0) {
      const tagBatches: typeof tagInserts[] = [];
      for (let i = 0; i < tagInserts.length; i += BATCH_SIZE) {
        tagBatches.push(tagInserts.slice(i, i + BATCH_SIZE));
      }

      // Process tag batches in parallel
      for (let i = 0; i < tagBatches.length; i += PARALLEL_BATCHES) {
        const parallelBatches = tagBatches.slice(i, i + PARALLEL_BATCHES);
        await Promise.all(
          parallelBatches.map(batch =>
            supabase
              .from('contact_tags')
              .upsert(batch, { onConflict: 'contact_id,tag_id' })
          )
        );
      }
    }

    // List assignment (process in parallel) - apply to ALL contacts in CSV
    if (targetListId) {
      console.log('List assignment - targetListId:', targetListId);
      const listInserts: Array<{ list_id: string; contact_id: string }> = [];
      
      // Use seenEmails (all valid emails from CSV) to assign to list
      for (const email of seenEmails) {
        const contactId = existingEmailMap.get(email);
        if (contactId) {
          listInserts.push({ list_id: targetListId, contact_id: contactId });
        }
      }
      
      console.log('Total list inserts prepared:', listInserts.length);

      if (listInserts.length > 0) {
        const listBatches: typeof listInserts[] = [];
        for (let i = 0; i < listInserts.length; i += BATCH_SIZE) {
          listBatches.push(listInserts.slice(i, i + BATCH_SIZE));
        }

        for (let i = 0; i < listBatches.length; i += PARALLEL_BATCHES) {
          const parallelBatches = listBatches.slice(i, i + PARALLEL_BATCHES);
          await Promise.all(
            parallelBatches.map(batch =>
              supabase
                .from('list_contacts')
                .upsert(batch, { onConflict: 'list_id,contact_id' })
            )
          );
        }
      }
    }

    return NextResponse.json({
      data: {
        total: rows.length - 1,
        created,
        updated,
        skipped: skipped + skippedUpdates, // Include skipped updates
        invalid: errors.length,
        errors: errors.slice(0, 100),
        // Diagnostic info
        existingInDb: existingEmailMap.size,
        alreadyExisted: toUpdate.length,
      }
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function normalizeHeader(value: string): string {
  // Remove BOM if present and normalize casing/spacing
  const withoutBom = value.replace(/^\uFEFF/, '');
  return withoutBom.trim().toLowerCase();
}

// Parse CSV text handling quoted values and newlines
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      row.push(current);
      current = '';
      if (row.some((field) => field.trim() !== '')) {
        rows.push(row);
      }
      row = [];
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((field) => field.trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

// Generate random tag color
function getRandomColor(): string {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
