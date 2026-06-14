-- SoundMyth · Personalization (Phase 1)
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Idempotent: safe to run more than once.
--
-- Adds preference columns to the existing public.profiles table so a logged-in
-- user's chosen cities / DJs / genres sync across devices (account = email).
-- Saved events already sync via the existing public.saved_events table.

alter table public.profiles
  add column if not exists home_cities  text[]      default '{}',
  add column if not exists fav_djs      text[]      default '{}',
  add column if not exists fav_genres   text[]      default '{}',
  add column if not exists onboarded_at timestamptz;

-- RLS: profiles already has row-level security (the app reads/writes marketing_opt_in).
-- These policies are created only if missing, so a user can read & write ONLY their own row.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own') then
    create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_upsert_own') then
    create policy profiles_upsert_own on public.profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own') then
    create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;

-- Verify:
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='profiles' order by ordinal_position;
