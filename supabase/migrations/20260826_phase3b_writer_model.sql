-- ============================================================
-- Phase 3B — Writer prompt, version 2 (model set)
-- Project: hme-blog-network
--
-- v1's model was a placeholder ('PLACEHOLDER_SET_IN_PHASE_3B').
-- The DeepSeek key is live now. Per the versioning rule, we do
-- not overwrite v1 — deactivate it and insert v2 with the same
-- body and model = 'deepseek-chat'.
--
-- Order matters: deactivate v1 before inserting v2 as active,
-- so the one-active-per-role/variant/content_profile index is
-- never asked to hold two active rows at once.
-- ============================================================

update prompts
set active = false
where role = 'writer' and variant is null and content_profile is null and version = 1;

insert into prompts (role, variant, content_profile, version, body, model, active, notes)
select role, variant, content_profile, 2, body, 'deepseek-chat', true,
       'Version 2. Same body as v1. Model set to deepseek-chat now that the API key is live.'
from prompts
where role = 'writer' and variant is null and content_profile is null and version = 1
on conflict (role, variant, content_profile, version) do update set
  model  = excluded.model,
  notes  = excluded.notes,
  active = excluded.active;


-- ============================================================
-- Verify
-- ============================================================
-- select role, version, model, active from prompts where role = 'writer' order by version;
