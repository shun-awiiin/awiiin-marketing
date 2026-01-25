import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/email-sender';

// POST /api/email/test - Send a test email
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body, fromName, fromEmail } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Get user settings for from name/email if not provided
    let finalFromName = fromName;
    let finalFromEmail = fromEmail;

    if (!finalFromName || !finalFromEmail) {
      const { data: userData } = await supabase
        .from('users')
        .select('settings')
        .eq('id', user.id)
        .single();

      if (userData?.settings) {
        finalFromName = finalFromName || userData.settings.sendFromName;
        finalFromEmail = finalFromEmail || userData.settings.sendFromEmail;
      }
    }

    if (!finalFromName || !finalFromEmail) {
      return NextResponse.json(
        { error: '送信者設定が必要です。設定画面で設定してください。' },
        { status: 400 }
      );
    }

    // Send test email
    const result = await sendEmail({
      to,
      subject: `[テスト] ${subject}`,
      text: body,
      fromName: finalFromName,
      fromEmail: finalFromEmail,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    );
  }
}
