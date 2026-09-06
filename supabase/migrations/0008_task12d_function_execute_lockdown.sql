-- =====================================================================
-- Task 12D — Deep Security Audit: Function EXECUTE Lockdown
-- =====================================================================
-- Finding (Database Security / "unrestricted functions" / "dangerous
-- grants"): every custom SQL function added in migrations 0002–0006
-- (pin_hash, pin_verify, generate_member_id, supreme_administrator_exists,
-- eligible_role_keys_for_category, dispatch_announcement_notifications,
-- run_announcement_scheduler) was created without an explicit EXECUTE
-- grant statement. PostgreSQL's default behaviour is to grant EXECUTE
-- on newly created functions to the PUBLIC pseudo-role, and every
-- database role (including Supabase's `anon` and `authenticated`
-- roles) is implicitly a member of PUBLIC. Supabase's PostgREST layer
-- additionally auto-exposes every function in an exposed schema
-- (`public` by default) as a callable `/rest/v1/rpc/<function_name>`
-- endpoint for whichever role the caller authenticates as.
--
-- Put together, this means — despite every migration's RLS comment
-- block explicitly stating "all privileged reads/writes go through
-- Edge Functions using the SERVICE ROLE key ... the anon key can
-- therefore never read or write these tables directly" — the anon key
-- (shipped in the client bundle, `VITE_SUPABASE_ANON_KEY`) could
-- likely call several of these functions DIRECTLY via PostgREST RPC,
-- bypassing the Edge Function layer entirely:
--
--   - pin_hash(text) / pin_verify(text, text): each call performs one
--     bcrypt computation (intentionally expensive, ~10 rounds). Being
--     directly callable by anon turns this into an unauthenticated
--     CPU-exhaustion / denial-of-service vector against the database
--     — completely independent of anything the `auth-login` Edge
--     Function's own rate limiting does, since that limiting never
--     runs on this path.
--   - generate_member_id(): directly callable, this lets anon burn
--     through the member_id sequence (DEV-00001, DEV-00002, ...)
--     without ever inserting a member row, wasting the human-readable
--     ID space and creating confusing gaps.
--   - supreme_administrator_exists(): directly callable, this leaks
--     whether the one-time bootstrap-admin step has already been
--     completed — a minor reconnaissance oracle for whether that
--     endpoint's window of usefulness has already closed.
--   - eligible_role_keys_for_category() / dispatch_announcement_-
--     notifications(): the former is harmless read-only logic; the
--     latter, if called directly with an arbitrary UUID, does nothing
--     unless that UUID matches a real announcements row (it looks the
--     row up itself) — low risk, but still not an intentionally public
--     entry point.
--   - run_announcement_scheduler(): directly callable, but idempotent
--     and only ever fast-forwards already-due scheduled/expiry
--     transitions that read-time filtering also always recomputes
--     independently — negligible risk, tightened anyway for
--     consistency with the "service-role only" trust boundary.
--
-- No table data is exposed by any of the above (RLS still denies every
-- row read/write for anon/authenticated on every table — this issue is
-- specifically about the FUNCTIONS being callable at all), but the
-- pin_hash/pin_verify DoS vector and the informational leaks are worth
-- closing, and doing so is a direct, mechanical restatement of the
-- trust boundary this project's own migrations already describe in
-- prose — not a new requirement.
--
-- Fix: explicitly REVOKE EXECUTE from PUBLIC (which also removes it
-- from anon/authenticated, both PUBLIC members) on every such function,
-- then GRANT EXECUTE back only to postgres/service_role — the roles
-- Edge Functions actually authenticate as when they call `admin.rpc(...)`
-- with the service-role key. touch_updated_at(), announcements_sync_-
-- status(), and trg_dispatch_announcement_notifications() are trigger
-- functions (return type `trigger`) and are not included: PostgREST
-- never exposes trigger functions as callable RPC endpoints (they can
-- only run inside a trigger context), so there is nothing to lock down
-- there.
-- =====================================================================

revoke execute on function pin_hash(text) from public;
revoke execute on function pin_verify(text, text) from public;
revoke execute on function generate_member_id() from public;
revoke execute on function supreme_administrator_exists() from public;
revoke execute on function eligible_role_keys_for_category(text) from public;
revoke execute on function dispatch_announcement_notifications(uuid) from public;
revoke execute on function run_announcement_scheduler() from public;

grant execute on function pin_hash(text) to postgres, service_role;
grant execute on function pin_verify(text, text) to postgres, service_role;
grant execute on function generate_member_id() to postgres, service_role;
grant execute on function supreme_administrator_exists() to postgres, service_role;
grant execute on function eligible_role_keys_for_category(text) to postgres, service_role;
grant execute on function dispatch_announcement_notifications(uuid) to postgres, service_role;
grant execute on function run_announcement_scheduler() to postgres, service_role;

-- run_announcement_scheduler() is still invoked by pg_cron (migration
-- 0005), which runs as the database owner (postgres) — already covered
-- by the grant above, so the scheduled job continues to work unchanged.
