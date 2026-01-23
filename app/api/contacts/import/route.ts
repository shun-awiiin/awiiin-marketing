import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidEmail } from '@/lib/email/template-renderer';
import { validateEmail, quickValidateEmail } from '@/lib/validation/email-validator';
import type { EmailRiskLevel } from '@/lib/types/deliverability';

interface CSVRow {
  email: string;
  firstName?: string;
  first_name?: string;
  company?: string;
  tags?: string;
}

interface ImportError {
  row: number;
  email: string;
  reason: string;
}

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
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must have header and at least one data row' }, { status: 400 });
    }

    // Parse header
    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
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

    // Get existing contacts
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id, email')
      .eq('user_id', user.id);

    const existingEmailMap = new Map(
      existingContacts?.map(c => [c.email.toLowerCase(), c.id]) || []
    );

    // Get existing tags
    const { data: existingTags } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', user.id);

    const tagNameToId = new Map(
      existingTags?.map(t => [t.name.toLowerCase(), t.id]) || []
    );

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
      validation_status?: EmailRiskLevel;
      validated_at?: string;
    }> = [];
    const validationResults: Map<string, { risk_level: EmailRiskLevel; validated_at: string }> = new Map();
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
      
      // If we have both first and last name, combine them (Japanese style: lastName + firstName)
      if (firstName && lastName) {
        firstName = `${lastName} ${firstName}`.trim();
      } else if (!firstName && lastName) {
        firstName = lastName;
      }
      
      const company = companyIndex >= 0 ? values[companyIndex]?.trim() || null : null;
      
      // Collect tags from tags column and HubSpot specific columns
      let tagsStr = tagsIndex >= 0 ? values[tagsIndex]?.trim() || '' : '';
      
      // Add marketing status as tag if present and not empty
      if (marketingStatusIndex >= 0) {
        const marketingStatus = values[marketingStatusIndex]?.trim();
        if (marketingStatus && marketingStatus !== '') {
          tagsStr = tagsStr ? `${tagsStr},${marketingStatus}` : marketingStatus;
        }
      }
      
      // Add lead status as tag if present and not empty  
      if (leadStatusIndex >= 0) {
        const leadStatus = values[leadStatusIndex]?.trim();
        if (leadStatus && leadStatus !== '') {
          tagsStr = tagsStr ? `${tagsStr},${leadStatus}` : leadStatus;
        }
      }

      // Validate email if enabled (use quick validation for performance)
      let validationStatus: EmailRiskLevel | undefined;
      let validatedAt: string | undefined;

      if (validateEmails) {
        const quickResult = quickValidateEmail(email);

        // Determine risk level based on quick validation
        if (!quickResult.valid) {
          validationStatus = 'critical';
        } else if (quickResult.isRoleBased) {
          validationStatus = 'medium';
        } else {
          validationStatus = 'low';
        }
        validatedAt = new Date().toISOString();
        validationResults.set(email, { risk_level: validationStatus, validated_at: validatedAt });
      }

      // Process tags
      const tagNames = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
      const tagIds: string[] = [];

      for (const tagName of tagNames) {
        let tagId = tagNameToId.get(tagName.toLowerCase());

        // Create tag if it doesn't exist
        if (!tagId) {
          const { data: newTag } = await supabase
            .from('tags')
            .insert({
              user_id: user.id,
              name: tagName,
              color: getRandomColor()
            })
            .select()
            .single();

          if (newTag) {
            tagId = newTag.id;
            tagNameToId.set(tagName.toLowerCase(), tagId);
          }
        }

        if (tagId) {
          tagIds.push(tagId);
        }
      }

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
            validation_status: validationStatus,
            validated_at: validatedAt
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

    // Batch insert new contacts
    let created = 0;
    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert(toInsert)
        .select();

      if (error) {
        console.error('Insert error:', error);
      } else {
        created = inserted?.length || 0;

        // Update email map with new contacts
        inserted?.forEach(c => {
          existingEmailMap.set(c.email.toLowerCase(), c.id);
        });
      }
    }

    // Batch update existing contacts
    let updated = 0;
    for (const contact of toUpdate) {
      const { error } = await supabase
        .from('contacts')
        .update({
          first_name: contact.first_name,
          company: contact.company
        })
        .eq('id', contact.id);

      if (!error) updated++;
    }

    // Assign tags
    for (const { email, tagIds } of tagAssignments) {
      const contactId = existingEmailMap.get(email);
      if (!contactId) continue;

      // Remove existing tags
      await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId);

      // Add new tags
      if (tagIds.length > 0) {
        await supabase
          .from('contact_tags')
          .insert(tagIds.map(tagId => ({
            contact_id: contactId,
            tag_id: tagId
          })));
      }
    }

    // Calculate validation summary
    const validationSummary = validateEmails ? {
      low_risk: Array.from(validationResults.values()).filter(v => v.risk_level === 'low').length,
      medium_risk: Array.from(validationResults.values()).filter(v => v.risk_level === 'medium').length,
      high_risk: Array.from(validationResults.values()).filter(v => v.risk_level === 'high').length,
      critical_risk: Array.from(validationResults.values()).filter(v => v.risk_level === 'critical').length,
    } : null;

    return NextResponse.json({
      data: {
        total: lines.length - 1,
        created,
        updated,
        skipped,
        invalid: errors.length,
        errors: errors.slice(0, 100), // Limit errors to first 100
        validation_summary: validationSummary
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
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
