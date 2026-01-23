import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '削除するキャンペーンを選択してください'),
});

// 削除不可のステータス
const ACTIVE_STATUSES = ['sending', 'queued', 'scheduled', 'paused'];

// POST /api/campaigns/bulk-delete - Bulk delete campaigns
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { ids } = validation.data;

    // 所有権と状態を確認
    const { data: campaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .in('id', ids)
      .eq('user_id', user.id);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // 見つからないキャンペーンがある場合
    if (!campaigns || campaigns.length !== ids.length) {
      const foundIds = campaigns?.map(c => c.id) || [];
      const notFoundIds = ids.filter(id => !foundIds.includes(id));
      return NextResponse.json(
        { error: `一部のキャンペーンが見つかりません: ${notFoundIds.length}件` },
        { status: 404 }
      );
    }

    // アクティブ状態のキャンペーンを分離
    const activeCampaigns = campaigns.filter(c => ACTIVE_STATUSES.includes(c.status));
    const deletableCampaigns = campaigns.filter(c => !ACTIVE_STATUSES.includes(c.status));

    if (deletableCampaigns.length === 0) {
      return NextResponse.json(
        { error: 'すべてのキャンペーンがアクティブ状態のため削除できません' },
        { status: 400 }
      );
    }

    // 削除可能なキャンペーンを削除
    const deletableIds = deletableCampaigns.map(c => c.id);
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .in('id', deletableIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        deleted: deletableCampaigns.map(c => ({ id: c.id, name: c.name })),
        deletedCount: deletableCampaigns.length,
        skipped: activeCampaigns.map(c => ({ id: c.id, name: c.name, status: c.status })),
        skippedCount: activeCampaigns.length,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: '内部サーバーエラー' }, { status: 500 });
  }
}
