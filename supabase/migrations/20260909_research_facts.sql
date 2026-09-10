-- ------------------------------------------------------------
-- Fix 4 (manager feedback) — research stage.
-- One row per article, written once before attempt 1, read by the
-- writer/reviser/grader as a new {{research_facts}} block — same
-- trust pattern as VERIFIED BRAND FACTS: only what's in here (or
-- brand_facts) may be stated as a real figure, always dated/sourced.
-- ------------------------------------------------------------
create table if not exists research_facts (
  id          text primary key default gen_random_uuid()::text,
  article_id  text not null references articles(id) on delete cascade,

  queries     jsonb not null,  -- the real search queries run
  sources     jsonb not null,  -- [{url, title, snippet, fetched_at, extract_excerpt}]
  fact_sheet  text not null,   -- structured, dated/sourced text fed to the writer

  created_at  timestamptz default now(),

  unique (article_id)
);

alter table research_facts enable row level security;

comment on table research_facts is
  'Real search results + extracted page content gathered once per article before the writer runs. Keeps every source so a fact claim in the draft can be traced back to where it came from.';
