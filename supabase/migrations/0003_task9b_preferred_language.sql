-- =====================================================================
-- Task 9B — Preferred Language SRS gap fix
-- =====================================================================
-- The SRS (Chapter 6/22.4) requires member registration to capture and
-- persist: Name, Member ID, Preferred Language, and an optional Mobile
-- Number. Task 9's original migration (0002) stored Name, Member ID and
-- Mobile Number but omitted Preferred Language entirely. This migration
-- adds the missing column without altering any other Task 9 behaviour.
--
-- Preferred Language reuses the app's existing, already-shipped i18n
-- language set (src/config/app.config.ts APP_CONFIG.supportedLanguages
-- = 'gu' | 'hi' | 'en') — no new language values are introduced here.
-- =====================================================================

alter table members
  add column if not exists preferred_language text
    not null default 'gu'
    check (preferred_language in ('gu', 'hi', 'en'));

comment on column members.preferred_language is
  'The devotee''s preferred app UI language at the time of registration (SRS Ch.6/22.4). One of gu | hi | en — the same set used by the app''s language-selection flow (src/config/app.config.ts). Defaults to gu (the app''s default language) for any pre-existing row and for admin accounts created via bootstrap-admin without an explicit value.';
