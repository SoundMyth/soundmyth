-- SoundMyth · Lock down table permissions (RLS)
-- Run once in the Supabase SQL editor. Idempotent & safe to re-run.
--
-- Why: the anon key ships in the public frontend, so anyone can call the API with it.
-- The frontend only needs to READ events. This makes events read-only for the public
-- and keeps every write to the service-role key (used only by the scrapers in CI, which
-- bypasses RLS). saved_events / profiles stay per-user.

-- ── 0) (optional) See the current state BEFORE applying ──────────────────────
-- select relname AS table, relrowsecurity AS rls_enabled
--   from pg_class where relname in ('events','saved_events','profiles');
-- select tablename, policyname, cmd, roles
--   from pg_policies where schemaname='public' and tablename in ('events','saved_events','profiles');
-- select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema='public' and table_name in ('events','saved_events')
--     and grantee in ('anon','authenticated') order by 1,2,3;

-- ── 1) EVENTS — public read-only ─────────────────────────────────────────────
alter table public.events enable row level security;

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select to anon, authenticated using (true);

-- Belt & suspenders: even if grants/policies existed, the public roles cannot write.
-- (Scrapers use the service_role key, which bypasses RLS and keeps full access.)
revoke insert, update, delete, truncate on public.events from anon, authenticated;

-- ── 2) SAVED_EVENTS — each user only their own rows ──────────────────────────
alter table public.saved_events enable row level security;

drop policy if exists saved_events_select_own on public.saved_events;
create policy saved_events_select_own on public.saved_events
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists saved_events_insert_own on public.saved_events;
create policy saved_events_insert_own on public.saved_events
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists saved_events_delete_own on public.saved_events;
create policy saved_events_delete_own on public.saved_events
  for delete to authenticated using (auth.uid() = user_id);

revoke insert, update, delete, truncate on public.saved_events from anon;
revoke select on public.saved_events from anon;

-- ── 3) PROFILES — already self-only via personalization.sql; re-assert RLS ────
alter table public.profiles enable row level security;
-- (profiles_select_own / _upsert_own / _update_own created by personalization.sql)

-- ── 4) Verify AFTER ──────────────────────────────────────────────────────────
-- Re-run the queries in section 0; events.rls_enabled = true, no write grants for
-- anon/authenticated, and the policies above should be listed.
