create extension if not exists "pgcrypto";

create table if not exists public.accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'Cash',
  currency text not null default 'USD',
  balance numeric not null default 0,
  icon text not null default 'M',
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null references public.accounts(id) on delete cascade,
  category text not null,
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.revenues (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null references public.accounts(id) on delete cascade,
  source text not null,
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
alter table public.expenses enable row level security;
alter table public.revenues enable row level security;

drop policy if exists "Users can read their accounts" on public.accounts;
drop policy if exists "Users can create their accounts" on public.accounts;
drop policy if exists "Users can update their accounts" on public.accounts;
drop policy if exists "Users can delete their accounts" on public.accounts;

create policy "Users can read their accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "Users can create their accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their accounts"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their expenses" on public.expenses;
drop policy if exists "Users can create their expenses" on public.expenses;
drop policy if exists "Users can update their expenses" on public.expenses;
drop policy if exists "Users can delete their expenses" on public.expenses;

create policy "Users can read their expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Users can create their expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their expenses"
  on public.expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their revenues" on public.revenues;
drop policy if exists "Users can create their revenues" on public.revenues;
drop policy if exists "Users can update their revenues" on public.revenues;
drop policy if exists "Users can delete their revenues" on public.revenues;

create policy "Users can read their revenues"
  on public.revenues for select
  using (auth.uid() = user_id);

create policy "Users can create their revenues"
  on public.revenues for insert
  with check (auth.uid() = user_id);

create policy "Users can update their revenues"
  on public.revenues for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their revenues"
  on public.revenues for delete
  using (auth.uid() = user_id);
