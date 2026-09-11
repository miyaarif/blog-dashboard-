-- ------------------------------------------------------------
-- Fix 8 (v2 pipeline architecture) -- outline stage.
-- One row per article, written once before attempt 1, read by the
-- writer/reviser as a new {{outline}} block -- same lifecycle pattern
-- as research_facts (20260909_research_facts.sql): computed once, never
-- rewritten across retries, so a hard-fail on content doesn't also
-- silently reshuffle the article's structure on the next attempt.
--
-- `sections` holds the full populated outline object (the section list,
-- committed takeaway_count, and real faq_topics together) -- kept as one
-- jsonb blob rather than three separate columns, since all three came
-- out of the same single model call and are always read together.
-- ------------------------------------------------------------
create table if not exists outlines (
  id            text primary key default gen_random_uuid()::text,
  article_id    text not null references articles(id) on delete cascade,

  content_shape text not null,  -- comparison | single_brand | buying_guide | explainer
  sections      jsonb not null, -- { sections: [...], takeaway_count, faq_topics }

  created_at    timestamptz default now(),

  unique (article_id)
);

alter table outlines enable row level security;

comment on table outlines is
  'Deterministic section skeleton (per content_shape) populated with real, fact-grounded content once per article before the writer runs. Reused unchanged by the writer and every reviser attempt on that article.';
