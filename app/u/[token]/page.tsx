import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function UnsubscribeTokenPage({ params }: Props) {
  const { token } = await params;

  const supabase = await createServiceClient();

  // Find unsubscribe record by token
  const { data: unsubRecord, error } = await supabase
    .from('unsubscribes')
    .select('email, contact_id, campaign_id')
    .eq('token', token)
    .single();

  if (error || !unsubRecord) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>無効なリンク</CardTitle>
            <CardDescription>
              このリンクは無効か、既に使用されています。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Perform unsubscribe
  const email = unsubRecord.email;

  // Update contact status
  if (unsubRecord.contact_id) {
    await supabase
      .from('contacts')
      .update({ status: 'unsubscribed' })
      .eq('id', unsubRecord.contact_id);
  } else {
    await supabase
      .from('contacts')
      .update({ status: 'unsubscribed' })
      .eq('email', email);
  }

  // Update unsubscribe record with reason
  await supabase
    .from('unsubscribes')
    .update({ reason: 'One-click unsubscribe' })
    .eq('token', token);

  // Log event
  await supabase.from('events').insert({
    provider: 'system',
    event_type: 'unsubscribe',
    email,
    campaign_id: unsubRecord.campaign_id,
    payload: { method: 'one-click', token },
    occurred_at: new Date().toISOString()
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <CardTitle>配信停止が完了しました</CardTitle>
          <CardDescription>
            {email} へのメール配信を停止しました。
            <br />
            今後、このメールアドレスへの配信は行われません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-center text-muted-foreground">
            この画面を閉じても問題ありません。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
