import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkDns } from '@/lib/dns/dns-checker';

// POST /api/dns/check - DNSレコードをチェック
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { domain } = await request.json();

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }

    // DNSチェック実行
    const result = await checkDns(domain);

    // 結果をDBに保存
    await supabase.from('dns_verification').upsert(
      {
        user_id: user.id,
        domain,
        spf_valid: result.spf.valid,
        dkim_valid: result.dkim.valid,
        dmarc_valid: result.dmarc.valid,
        dmarc_policy: result.dmarc.policy,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,domain' }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('DNS check error:', error);
    return NextResponse.json(
      { error: 'DNS check failed' },
      { status: 500 }
    );
  }
}

// GET /api/dns/check?domain=example.com - 保存済みの結果を取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const domain = request.nextUrl.searchParams.get('domain');

    if (!domain) {
      // 全ドメインの結果を返す
      const { data } = await supabase
        .from('dns_verification')
        .select('*')
        .eq('user_id', user.id)
        .order('last_checked_at', { ascending: false });

      return NextResponse.json({ domains: data ?? [] });
    }

    // 特定ドメインの結果
    const { data } = await supabase
      .from('dns_verification')
      .select('*')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .single();

    if (!data) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('DNS get error:', error);
    return NextResponse.json(
      { error: 'Failed to get DNS status' },
      { status: 500 }
    );
  }
}
