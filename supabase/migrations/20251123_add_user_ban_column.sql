-- Add is_banned flag to user_profiles to support admin controls
alter table if exists public.user_profiles
  add column if not exists is_banned boolean not null default false;

create index if not exists user_profiles_is_banned_idx
  on public.user_profiles (is_banned);

