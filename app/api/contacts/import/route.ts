import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidEmail } from '@/lib/email/template-renderer';
import { quickValidateEmail } from '@/lib/validation/email-validator';
import type { EmailRiskLevel } from '@/lib/types/deliverability';

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

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Parse CSV
    const text = await file.text();
    console.log('File size:', text.length, 'bytes');
    
    const lines = text.split('\n').filter(line => line.trim());
    console.log('Total lines:', lines.length);

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must have header and at least one data row' }, { status: 400 });
    }

    // Parse header
    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    console.log('Header columns:', header.length, 'First 5:', header.slice(0, 5));
    
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

    console.log('Email index:', emailIndex, 'FirstName index:', firstNameIndex, 'LastName index:', lastNameIndex);
    
    // Debug: show first 3 data rows parsed
    for (let i = 1; i <= Math.min(3, lines.length - 1); i++) {
      const testValues = parseCSVLine(lines[i]);
      console.log(`Row ${i} parsed:`, {
        totalColumns: testValues.length,
        email: testValues[emailIndex] || '(empty)',
        firstName: testValues[firstNameIndex] || '(empty)',
      });
    }
    
    if (emailIndex === -1) {
      return NextResponse.json({ error: 'CSV must have an "email" or "Eメール" column' }, { status: 400 });
    }

    // Get existing contacts count first
    const { count: existingCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    console.log('Existing contacts in database:', existingCount);
    
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
    
    console.log('Loaded existing emails:', existingEmailMap.size);

    // Get existing tags
    const { data: existingTags } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', user.id);

    const tagNameToId = new Map(
      existingTags?.map(t => [t.name.toLowerCase(), t.id]) || []
    );

    // First pass: collect all unique tag names to pre-create them
    const allTagNames = new Set<string>();
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
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
      validation_status?: EmailRiskLevel;
      validated_at?: string;
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

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
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
      let validationStatus: EmailRiskLevel | undefined;
      let validatedAt: string | undefined;

      if (validateEmails) {
        const quickResult = quickValidateEmail(email);
        if (!quickResult.valid) {
          validationStatus = 'critical';
        } else if (quickResult.isRoleBased) {
          validationStatus = 'medium';
        } else {
          validationStatus = 'low';
        }
        validatedAt = new Date().toISOString();
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
          validation_status: validationStatus,
          validated_at: validatedAt
        });
      }
    }

    // Summary before batch operations
    const summary = {
      totalDataRows: lines.length - 1,
      toInsert: toInsert.length,
      toUpdate: toUpdate.length,
      skippedDuplicates: skipped,
      invalidEmails: errors.length,
      existingInDb: existingEmailMap.size,
    };
    console.log('Processing summary:', JSON.stringify(summary));
    
    // Sanity check
    const accounted = toInsert.length + toUpdate.length + skipped + errors.length;
    console.log(`Accounted rows: ${accounted} / ${lines.length - 1} (diff: ${lines.length - 1 - accounted})`);
    
    let created = 0;
    const totalBatches = Math.ceil(toInsert.length / BATCH_SIZE);
    
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} records)`);
      
      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert(batch)
        .select();

      if (error) {
        console.error(`Batch ${batchNum} insert error:`, error.message, error.details);
      } else {
        created += inserted?.length || 0;
        console.log(`Batch ${batchNum} inserted: ${inserted?.length || 0} records`);
        
        // Update email map with new contacts
        inserted?.forEach(c => {
          existingEmailMap.set(c.email.toLowerCase(), c.id);
        });
      }
    }
    
    console.log('Total created:', created);

    // Batch update existing contacts (limit to avoid timeout)
    let updated = 0;
    const MAX_UPDATES = 1000; // Limit updates to avoid timeout
    const updatesToProcess = toUpdate.slice(0, MAX_UPDATES);
    
    console.log(`Updating ${updatesToProcess.length} of ${toUpdate.length} existing contacts`);
    
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
    if (skippedUpdates > 0) {
      console.log(`Skipped ${skippedUpdates} updates to avoid timeout`);
    }

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

    return NextResponse.json({
      data: {
        total: lines.length - 1,
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
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// Generate random tag color
function getRandomColor(): string {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
