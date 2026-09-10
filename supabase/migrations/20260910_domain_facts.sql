-- ------------------------------------------------------------
-- Fix 5 (manager feedback) — curated verified-facts mechanism.
-- Keyed on `vertical` (sites.vertical), NOT content_profile -- checked
-- real data first: site_scholar ("Student Lending") and site_fuel
-- ("Small Business Financing") share content_profile "ymyl_finance"
-- but are genuinely different domains. These facts (grace period
-- length, PLUS loan deferment rules, rate-shopping window, cosigner
-- terminology) are student-loan-specific; keying on content_profile
-- would have leaked them into Fuel's business-financing generations.
-- ------------------------------------------------------------
create table if not exists domain_facts (
  id            text primary key default gen_random_uuid()::text,
  vertical      text not null,        -- matches sites.vertical, e.g. "Student Lending"
  claim         text not null,        -- the wrong claim commonly made
  correct_fact  text not null,        -- the verified truth
  confidence    text not null check (confidence in ('sourced', 'verified_assertion')),
  source        text,                 -- nullable -- not every fact has one clean citable source
  created_at    timestamptz default now()
);

create index if not exists idx_domain_facts_vertical on domain_facts(vertical);

alter table domain_facts enable row level security;

comment on table domain_facts is
  'Curated, human-verified domain facts to correct real hallucinations found in production. confidence=sourced means a real citable source exists (see `source`); confidence=verified_assertion means the fact is real and verified through converging evidence but has no single clean citable source -- state it plainly, never fabricate a citation for it.';
