-- Face Aura user data. Face images are deliberately not persisted.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skin_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goals text[] not null default '{}',
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  blemishes smallint not null check (blemishes between 0 and 100),
  dark_spots smallint not null check (dark_spots between 0 and 100),
  hydration smallint not null check (hydration between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  salon_id text not null,
  salon_name text not null,
  treatment text not null,
  starts_at timestamptz not null,
  price_gbp numeric(8, 2) not null check (price_gbp >= 0),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index skin_analyses_user_created_idx on public.skin_analyses (user_id, created_at desc);
create index progress_entries_user_date_idx on public.progress_entries (user_id, checkin_date desc);
create index bookings_user_start_idx on public.bookings (user_id, starts_at desc);

alter table public.profiles enable row level security;
alter table public.skin_analyses enable row level security;
alter table public.progress_entries enable row level security;
alter table public.bookings enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "analyses_select_own" on public.skin_analyses for select to authenticated
using ((select auth.uid()) = user_id);
create policy "analyses_insert_own" on public.skin_analyses for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "analyses_delete_own" on public.skin_analyses for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "progress_select_own" on public.progress_entries for select to authenticated
using ((select auth.uid()) = user_id);
create policy "progress_insert_own" on public.progress_entries for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "progress_update_own" on public.progress_entries for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "progress_delete_own" on public.progress_entries for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "bookings_select_own" on public.bookings for select to authenticated
using ((select auth.uid()) = user_id);
create policy "bookings_insert_own" on public.bookings for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "bookings_update_own" on public.bookings for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.skin_analyses, public.progress_entries, public.bookings from anon;
grant select, insert, update, delete on public.profiles, public.skin_analyses, public.progress_entries, public.bookings to authenticated;
