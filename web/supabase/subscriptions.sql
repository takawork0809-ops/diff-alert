-- 課金(Stripe)の契約状況を保存するテーブル。Supabase の SQL Editor で実行してください。
-- 書き込みは Stripe からの通知(webhook)を受けるサーバーだけが、service_role で行う。
-- ユーザーは自分の行を読むだけ(RLS)。

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text check (plan in ('standard', 'pro')),
  status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);
