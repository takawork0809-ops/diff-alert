-- diff-alert: 監視商品テーブル。Supabase の SQL Editor で実行してください。
create table if not exists public.monitored_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asin text not null,
  rakuten_url text not null,
  category text not null default 'other'
    check (category in ('electronics', 'game', 'apparel', 'other')),
  target_margin integer not null default 0,
  product_name text,
  last_amazon_price integer,
  last_rakuten_price integer,
  last_net_margin integer,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, asin)
);

alter table public.monitored_products enable row level security;

-- ログインユーザーは自分の行だけ参照・追加・更新・削除できる
create policy "own rows select" on public.monitored_products
  for select using (auth.uid() = user_id);
create policy "own rows insert" on public.monitored_products
  for insert with check (auth.uid() = user_id);
create policy "own rows update" on public.monitored_products
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows delete" on public.monitored_products
  for delete using (auth.uid() = user_id);

create index if not exists monitored_products_user_idx
  on public.monitored_products (user_id, created_at desc);
