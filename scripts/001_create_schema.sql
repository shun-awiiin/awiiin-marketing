-- ============================================
-- メール配信管理ツール DBスキーマ
-- ============================================

-- 1. users テーブル（プロファイル用、auth.usersを参照）
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamp with time zone default now()
);

alter table public.users enable row level security;

create policy "users_select_authenticated" on public.users 
  for select using (auth.uid() is not null);

create policy "users_insert_own" on public.users 
  for insert with check (auth.uid() = id);

create policy "users_update_own" on public.users 
  for update using (auth.uid() = id);

-- 2. contacts テーブル
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  first_name text,
  status text not null default 'active' check (status in ('active', 'bounced', 'complained', 'unsubscribed')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.contacts enable row level security;

create policy "contacts_all_authenticated" on public.contacts 
  for all using (auth.uid() is not null);

-- 3. tags テーブル
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamp with time zone default now()
);

alter table public.tags enable row level security;

create policy "tags_all_authenticated" on public.tags 
  for all using (auth.uid() is not null);

-- 4. contact_tags 中間テーブル
create table if not exists public.contact_tags (
  contact_id uuid references public.contacts(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

alter table public.contact_tags enable row level security;

create policy "contact_tags_all_authenticated" on public.contact_tags 
  for all using (auth.uid() is not null);

-- 5. templates テーブル
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('SEMINAR_INVITE', 'FREE_TRIAL_INVITE')),
  version int not null default 1,
  subject_variants jsonb not null default '[]'::jsonb,
  body_text text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone default now()
);

alter table public.templates enable row level security;

create policy "templates_select_authenticated" on public.templates 
  for select using (auth.uid() is not null);

create policy "templates_admin_all" on public.templates 
  for all using (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role = 'admin'
    )
  );

-- 6. campaigns テーブル
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('SEMINAR_INVITE', 'FREE_TRIAL_INVITE')),
  template_id uuid references public.templates(id),
  input_payload jsonb not null default '{}'::jsonb,
  audience_tag_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'queued', 'sending', 'paused', 'stopped', 'completed')),
  send_from_name text not null default 'Awiiin',
  send_from_email text not null default 'no-reply@m.awiiin.com',
  rate_limit_per_minute int not null default 20,
  created_by uuid references public.users(id),
  created_at timestamp with time zone default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

alter table public.campaigns enable row level security;

create policy "campaigns_all_authenticated" on public.campaigns 
  for all using (auth.uid() is not null);

-- 7. messages テーブル
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body_text text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'unsubscribed', 'failed')),
  provider_message_id text,
  last_error text,
  created_at timestamp with time zone default now(),
  sent_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

alter table public.messages enable row level security;

create policy "messages_all_authenticated" on public.messages 
  for all using (auth.uid() is not null);

-- 8. events テーブル
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'ses',
  provider_message_id text,
  event_type text not null check (event_type in ('send', 'delivery', 'bounce', 'complaint', 'open', 'click', 'unsubscribe')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table public.events enable row level security;

create policy "events_all_authenticated" on public.events 
  for all using (auth.uid() is not null);

-- 9. unsubscribes テーブル
create table if not exists public.unsubscribes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  token text unique not null,
  created_at timestamp with time zone default now()
);

alter table public.unsubscribes enable row level security;

create policy "unsubscribes_all_authenticated" on public.unsubscribes 
  for all using (auth.uid() is not null);

-- 公開アクセス用（配信停止ページ用）
create policy "unsubscribes_public_select" on public.unsubscribes 
  for select using (true);

-- 10. audit_logs テーブル
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id),
  action text not null,
  target_id uuid,
  payload jsonb,
  created_at timestamp with time zone default now()
);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_authenticated" on public.audit_logs 
  for select using (auth.uid() is not null);

create policy "audit_logs_insert_authenticated" on public.audit_logs 
  for insert with check (auth.uid() is not null);

-- ============================================
-- トリガー: 新規ユーザー作成時にprofileを自動作成
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (
    new.id,
    new.email,
    'editor'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================
-- 初期テンプレートデータ
-- ============================================
insert into public.templates (type, version, subject_variants, body_text, is_active)
values 
(
  'SEMINAR_INVITE',
  1,
  '["{{firstName}}さん、1点だけ共有です", "{{firstName}}さん向けにご連絡です（短時間）", "{{firstName}}さん、来週の件でご案内です"]'::jsonb,
  '{{firstName}}さん

お世話になっております。
Awiiinの菊池です。

一点だけ共有です。

{{date}} {{time}}から{{duration_minutes}}分ほど、
【{{seminar_title}}】についてオンラインでお話しします。

{{#if target_audience}}
対象：{{target_audience}}
{{/if}}

{{#if extra_bullets}}
{{#each extra_bullets}}
・{{this}}
{{/each}}
{{/if}}

もしご都合合えば、こちらから確認できます。
{{url}}

不要でしたらスルーで大丈夫です。

Awiiin
菊池',
  true
),
(
  'FREE_TRIAL_INVITE',
  1,
  '["{{firstName}}さん、先日の件で1点だけ", "{{firstName}}さん向けに共有です", "{{firstName}}さん、試せるようにしておきました"]'::jsonb,
  '{{firstName}}さん

先日はありがとうございました。
Awiiinの菊池です。

その後、何名かの方から「試してみたい」という声があったので
一応共有です。

{{tool_name}}：{{one_liner}}

こちらから確認できます。
{{url}}

不要でしたら無視で大丈夫です。

Awiiin
菊池',
  true
)
on conflict do nothing;

-- ============================================
-- インデックス
-- ============================================
create index if not exists idx_contacts_status on public.contacts(status);
create index if not exists idx_contacts_email on public.contacts(email);
create index if not exists idx_messages_campaign_id on public.messages(campaign_id);
create index if not exists idx_messages_status on public.messages(status);
create index if not exists idx_events_provider_message_id on public.events(provider_message_id);
create index if not exists idx_campaigns_status on public.campaigns(status);
