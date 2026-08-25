-- ============================================================
-- Phase 1 — AI blog pipeline tables
-- Project: hme-blog-network
--
-- Adds 8 tables. Changes NOTHING that already exists.
-- No DROP, no ALTER on articles/sites/keywords.
--
-- IDs are text to match the existing articles.id and sites.id.
-- ============================================================


-- ------------------------------------------------------------
-- 1. brand_profiles
-- How OUR site writes. sites already holds audience, vertical
-- and content_profile, so this table only adds voice detail.
-- One row per site.
-- ------------------------------------------------------------
create table if not exists brand_profiles (
  id                text primary key default gen_random_uuid()::text,
  site_id           text not null references sites(id) on delete cascade,

  tone              text not null,
  reading_level     text,
  person            text,              -- 'second person you, we for our view'
  sentence_rhythm   text,
  use_contractions  boolean default true,
  use_em_dashes     boolean default true,

  structure_rules   text,
  heading_style     text,              -- 'conversational, never Introduction'
  opening_style     text,
  cta_style         text,

  banned_words      text[] default '{}',
  mandatory_elements text[] default '{}',
  must_avoid        text,

  example_posts     text[] default '{}',  -- full text of 2-3 real posts
  typical_word_count int,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),

  unique (site_id)
);


-- ------------------------------------------------------------
-- 2. brands
-- Affiliate / partner companies we write ABOUT.
-- e.g. College Ave, Sallie Mae.
-- The writer may ONLY use facts from here. Never invented.
-- ------------------------------------------------------------
create table if not exists brands (
  id                text primary key default gen_random_uuid()::text,
  name              text not null,
  vertical          text,              -- matches sites.vertical
  website           text,

  what_they_are     text,              -- 'arranges loans via partner banks'
  strengths         text[] default '{}',
  weaknesses        text[] default '{}',   -- required: fairness rule
  eligibility       text,
  product_range     text,
  rate_note         text,              -- 'fixed and variable, check site'

  affiliate_link    text,
  disclosure_text   text,

  last_verified_at  date,
  verified_by       text,
  active            boolean default true,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),

  unique (name)
);

comment on column brands.weaknesses is
  'Required. An article where a brand has no downside reads as an ad.';
comment on column brands.last_verified_at is
  'Lender terms change. Stale facts must not enter new articles.';


-- ------------------------------------------------------------
-- 3. article_brands
-- Join table. A comparison article covers several brands.
-- ------------------------------------------------------------
create table if not exists article_brands (
  article_id  text not null references articles(id) on delete cascade,
  brand_id    text not null references brands(id)   on delete restrict,
  role        text not null default 'primary',   -- primary | compared
  position    int,                               -- display order

  primary key (article_id, brand_id)
);


-- ------------------------------------------------------------
-- 4. prompts
-- Writer and grader instructions, stored as data.
-- Versioned. Never overwrite a row — insert a new version.
-- ------------------------------------------------------------
create table if not exists prompts (
  id              text primary key default gen_random_uuid()::text,
  role            text not null,        -- writer | grader
  variant         text,                 -- null = base, or 'retry'
  content_profile text,                 -- standard | ymyl_finance | null = any
  version         int  not null,
  body            text not null,
  model           text not null,
  notes           text,
  active          boolean default false,
  created_at      timestamptz default now(),

  unique (role, variant, content_profile, version)
);

-- only one active prompt per role/variant/profile
create unique index if not exists prompts_one_active
  on prompts (role, coalesce(variant,''), coalesce(content_profile,''))
  where active;


-- ------------------------------------------------------------
-- 5. rubrics
-- Scoring criteria. Keyed on content_profile, not site,
-- so new sites inherit automatically.
-- ------------------------------------------------------------
create table if not exists rubrics (
  id              text primary key default gen_random_uuid()::text,
  content_profile text not null,        -- standard | ymyl_finance
  version         int  not null,
  criteria        jsonb not null,       -- [{name, weight, scale_1, scale_5}]
  hard_fail_rules jsonb default '[]',
  pass_threshold  int  not null,
  active          boolean default false,
  created_at      timestamptz default now(),

  unique (content_profile, version)
);

create unique index if not exists rubrics_one_active
  on rubrics (content_profile) where active;


-- ------------------------------------------------------------
-- 6. drafts
-- EVERY attempt is kept. Never overwritten.
-- Winning draft is copied into articles.body_markdown on approval.
-- ------------------------------------------------------------
create table if not exists drafts (
  id                text primary key default gen_random_uuid()::text,
  article_id        text not null references articles(id) on delete cascade,
  version           int  not null,

  body_markdown     text not null,
  meta_description  text,
  slug              text,
  hero_image_alt    text,
  sources           text[] default '{}',
  internal_links    text[] default '{}',
  word_count        int,

  prompt_id         text references prompts(id),
  model             text,
  input_tokens      int,
  output_tokens     int,
  cost_cl           numeric(10,4),      -- CL, not dollars

  created_at        timestamptz default now(),

  unique (article_id, version)
);

comment on table drafts is
  'Every version kept. This is the improvement history and the debug trail.';


-- ------------------------------------------------------------
-- 7. grades
-- One row per draft graded.
-- issues holds the line-level feedback the writer uses on retry.
-- ------------------------------------------------------------
create table if not exists grades (
  id                text primary key default gen_random_uuid()::text,
  draft_id          text not null references drafts(id) on delete cascade,

  scores            jsonb not null,     -- {criterion: 1-5}
  weighted_total    int  not null,
  passed            boolean not null,
  hard_fail_reason  text,

  -- [{criterion, severity, quote, problem, suggested_fix}]
  issues            jsonb default '[]',
  verdict_summary   text,

  rubric_id         text references rubrics(id),
  prompt_id         text references prompts(id),
  model             text,
  input_tokens      int,
  output_tokens     int,
  cost_cl           numeric(10,4),

  created_at        timestamptz default now(),

  unique (draft_id)
);


-- ------------------------------------------------------------
-- 8. loop_runs
-- One row per pipeline run. This answers "is it working".
-- ------------------------------------------------------------
create table if not exists loop_runs (
  id              text primary key default gen_random_uuid()::text,
  article_id      text not null references articles(id) on delete cascade,

  attempts_used   int not null,
  first_score     int,
  final_score     int,
  best_draft_id   text references drafts(id),

  -- passed | max_attempts | no_improvement | error
  outcome         text not null,
  error_detail    text,

  total_input_tokens  int,
  total_output_tokens int,
  total_cost_cl       numeric(10,4),
  duration_ms         int,

  started_at      timestamptz default now(),
  finished_at     timestamptz
);


-- ------------------------------------------------------------
-- Indexes for the queries the dashboard will actually run
-- ------------------------------------------------------------
create index if not exists idx_drafts_article    on drafts(article_id, version desc);
create index if not exists idx_grades_draft      on grades(draft_id);
create index if not exists idx_loop_runs_article on loop_runs(article_id, started_at desc);
create index if not exists idx_article_brands_b  on article_brands(brand_id);
create index if not exists idx_brands_stale      on brands(last_verified_at) where active;


-- ------------------------------------------------------------
-- Row Level Security
-- Enabled with no policies = service_role only.
-- The Edge Function uses service_role, so the pipeline works.
-- Nothing is readable from the browser until you add policies.
-- ------------------------------------------------------------
alter table brand_profiles enable row level security;
alter table brands         enable row level security;
alter table article_brands enable row level security;
alter table prompts        enable row level security;
alter table rubrics        enable row level security;
alter table drafts         enable row level security;
alter table grades         enable row level security;
alter table loop_runs      enable row level security;

-- NOTE: prompts contains your instructions and brands contains
-- commercial terms. Do not add public read policies to those two
-- without thinking about it first.