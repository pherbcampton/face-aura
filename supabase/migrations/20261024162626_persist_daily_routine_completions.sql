-- Persist each signed-in user's AM/PM checklist for the current calendar day.
create table public.daily_routine_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  completion_date date not null default current_date,
  morning_steps text[] not null default '{}',
  evening_steps text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, completion_date),
  constraint daily_routine_morning_step_limit check (cardinality(morning_steps) <= 20),
  constraint daily_routine_evening_step_limit check (cardinality(evening_steps) <= 20)
);

alter table public.daily_routine_completions enable row level security;

create policy "daily_routines_select_own" on public.daily_routine_completions
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "daily_routines_insert_own" on public.daily_routine_completions
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "daily_routines_update_own" on public.daily_routine_completions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "daily_routines_delete_own" on public.daily_routine_completions
for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.daily_routine_completions from anon;
grant select, insert, update, delete on public.daily_routine_completions to authenticated;

comment on table public.daily_routine_completions is
'Owner-only daily completion state for the generated morning and evening skincare routines.';
