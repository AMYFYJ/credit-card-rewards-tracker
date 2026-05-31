create table if not exists public.reward_tracker_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  version integer not null default 2,
  updated_at timestamptz not null default now()
);

alter table public.reward_tracker_states enable row level security;

grant select, insert, update on public.reward_tracker_states to authenticated;

drop policy if exists "select own tracker state" on public.reward_tracker_states;
create policy "select own tracker state"
  on public.reward_tracker_states for select
  using (auth.uid() = user_id);

drop policy if exists "insert own tracker state" on public.reward_tracker_states;
create policy "insert own tracker state"
  on public.reward_tracker_states for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own tracker state" on public.reward_tracker_states;
create policy "update own tracker state"
  on public.reward_tracker_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_reward_tracker_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_reward_tracker_states_updated_at on public.reward_tracker_states;
create trigger set_reward_tracker_states_updated_at
  before update on public.reward_tracker_states
  for each row
  execute function public.set_reward_tracker_updated_at();
