-- diff-alert: 自動スカウト用テーブル。Supabase の SQL Editor で実行してください。
-- 旧 monitored_products は残します(削除しません)。

create table if not exists public.watch_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  keyword text not null check (char_length(keyword) between 1 and 80),
  min_profit integer not null default 1000 check (min_profit >= 0),
  sources text[] not null default array['mercari', 'yahuoku']
    check (cardinality(sources) > 0 and sources <@ array['mercari', 'yahuoku']),
  category text not null default 'other'
    check (category in ('electronics', 'game', 'apparel', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.found_items (
  id uuid primary key default gen_random_uuid(),
  condition_id uuid not null references public.watch_conditions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('mercari', 'yahuoku')),
  item_title text not null,
  item_url text not null,
  item_price integer not null,
  amazon_title text,
  amazon_asin text,
  amazon_price integer,
  estimated_profit integer not null,
  found_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (condition_id, item_url)
);

alter table public.watch_conditions enable row level security;
alter table public.found_items enable row level security;

-- ログインユーザーは自分の行だけ扱える。found_items の追加はスクレイパー(service_role)だけが行う。
create policy "own conditions select" on public.watch_conditions
  for select using (auth.uid() = user_id);
create policy "own conditions insert" on public.watch_conditions
  for insert with check (auth.uid() = user_id);
create policy "own conditions update" on public.watch_conditions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own conditions delete" on public.watch_conditions
  for delete using (auth.uid() = user_id);

create policy "own found select" on public.found_items
  for select using (auth.uid() = user_id);
create policy "own found delete" on public.found_items
  for delete using (auth.uid() = user_id);

create index if not exists watch_conditions_user_idx on public.watch_conditions (user_id, created_at desc);
create index if not exists found_items_user_idx on public.found_items (user_id, found_at desc);
create index if not exists found_items_unnotified_idx on public.found_items (user_id) where notified_at is null;
