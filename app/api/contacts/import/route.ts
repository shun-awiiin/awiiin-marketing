import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

const BATCH_SIZE = 500; // Supabase batch insert limit

// POST /api/contacts/import - Import contacts from CSV
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const insertErrors: Array<{ batch: number; message: string; details?: string }> = [];

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batch = toInsert.slice(i, i + BATCH_SIZE);

      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert(batch)
        .select();

      if (error) {
        insertErrors.push({
          batch: batchNum,
          message: error.message,
          details: error.details,
        });
      } else {
        created += inserted?.length || 0;
        // Update email map with new contacts
        inserted?.forEach(c => {
          existingEmailMap.set(c.email.toLowerCase(), c.id);
        });
      }
    }

    if (insertErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Insert failed',
          details: insertErrors.slice(0, 3),
        },
        { status: 500 }
      );
    }

    // Batch update existing contacts (limit to avoid timeout)
    let updated = 0;
    const MAX_UPDATES = 1000;
    const updatesToProcess = toUpdate.slice(0, MAX_UPDATES);

    for (let i = 0; i < updatesToProcess.length; i += BATCH_SIZE) {
      const batch = updatesToProcess.slice(i, i + BATCH_SIZE);
      
      // Update each contact (Supabase doesn't support bulk update)
      for (const contact of batch) {
        const { error } = await supabase
          .from('contacts')
          .update({
            first_name: contact.first_name,
            company: contact.company
          })
          .eq('id', contact.id);

        if (!error) updated++;
      }
    }
    
    const skippedUpdates = toUpdate.length - updatesToProcess.length;

    // Batch assign tags
    const tagInserts: Array<{ contact_id: string; tag_id: string }> = [];
    
    for (const { email, tagIds } of tagAssignments) {
      const contactId = existingEmailMap.get(email);
      if (!contactId) continue;
      
      for (const tagId of tagIds) {
        tagInserts.push({ contact_id: contactId, tag_id: tagId });
      }
    }
    
    // Insert tag assignments in batches
    for (let i = 0; i < tagInserts.length; i += BATCH_SIZE) {
      const batch = tagInserts.slice(i, i + BATCH_SIZE);
      await supabase
        .from('contact_tags')
        .upsert(batch, { onConflict: 'contact_id,tag_id' });
    }

    // Bulk tag assignment (from import settings)
    if (bulkTagIds.length > 0) {
      const allContactIds = Array.from(existingEmailMap.values());
      const bulkTagInserts: Array<{ contact_id: string; tag_id: string }> = [];

      for (const contactId of allContactIds) {
        for (const tagId of bulkTagIds) {
          bulkTagInserts.push({ contact_id: contactId, tag_id: tagId });
        }
      }

      // Insert bulk tag assignments in batches
      for (let i = 0; i < bulkTagInserts.length; i += BATCH_SIZE) {
        const batch = bulkTagInserts.slice(i, i + BATCH_SIZE);
        await supabase
          .from('contact_tags')
          .upsert(batch, { onConflict: 'contact_id,tag_id' });
      }
    }

    // List assignment
    if (targetListId) {
      const allContactIds = Array.from(existingEmailMap.values());
      const listInserts = allContactIds.map(contactId => ({
        list_id: targetListId,
        contact_id: contactId
      }));

      // Insert list assignments in batches
      // Note: contact_count is updated automatically by database trigger
      for (let i = 0; i < listInserts.length; i += BATCH_SIZE) {
        const batch = listInserts.slice(i, i + BATCH_SIZE);
        await supabase
          .from('list_contacts')
          .upsert(batch, { onConflict: 'list_id,contact_id' });
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
