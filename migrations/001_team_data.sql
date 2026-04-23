-- Team-scoped data table for shared content
-- Run this migration in the Supabase SQL editor

create table if not exists team_data (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references teams(id) on delete cascade not null,
  data_key text not null,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  unique(team_id, data_key)
);

alter table team_data enable row level security;

create policy "Team members can read team data"
  on team_data for select
  using (public.is_team_member(team_id));

create policy "Team members can insert team data"
  on team_data for insert
  with check (public.is_team_member(team_id));

create policy "Team members can update team data"
  on team_data for update
  using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

create policy "Team members can delete team data"
  on team_data for delete
  using (public.is_team_member(team_id));
