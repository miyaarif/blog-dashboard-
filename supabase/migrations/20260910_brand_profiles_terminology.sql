-- ------------------------------------------------------------
-- Fix 5 (manager feedback) — brand terminology / glossary.
-- Real root cause: HME's brand_profiles row only ever had `tone`
-- populated (confirmed via real query 2026-09-10); every other field,
-- including anything that could disambiguate a term like "sponsored
-- video", was empty. jsonb array of {term, real_meaning}, matching the
-- existing pattern for structured lists in this schema (rubrics.criteria,
-- grades.issues) rather than a single free-text paragraph -- each entry
-- has two related fields, and this stays reviewable/editable per term
-- instead of needing to parse a prose blob.
-- ------------------------------------------------------------
alter table brand_profiles add column if not exists terminology jsonb default '[]';

comment on column brand_profiles.terminology is
  'Real, verified terms this site uses differently than their general meaning -- [{term, real_meaning}]. Threaded into the writer/reviser as {{terminology}} and into the grader via formatBrandProfileText().';
