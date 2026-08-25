-- ============================================================
-- Phase 2 — Seed data
-- Project: hme-blog-network
--
-- Seeds: 1 brand_profile (ScholarRoads), 2 brands, 2 rubrics
-- Safe to re-run: uses on conflict do update.
--
-- HME and Fuel profiles are NOT seeded. No published content
-- exists for them, so their voice cannot be extracted honestly.
-- Propose, get approval, then seed.
-- ============================================================


-- ------------------------------------------------------------
-- 1. brand_profiles — ScholarRoads
--
-- Derived from a real published article:
-- "College Ave vs. Sallie Mae: which private student loan
--  is right for you?" (Updated August 2026)
-- plus the Top Picks comparison page.
--
-- sites already holds audience and vertical, so this table
-- only carries voice detail not already stored there.
-- ------------------------------------------------------------
insert into brand_profiles (
  site_id, tone, reading_level, person, sentence_rhythm,
  use_contractions, use_em_dashes,
  structure_rules, heading_style, opening_style, cta_style,
  banned_words, mandatory_elements, must_avoid,
  typical_word_count
) values (
  'site_scholar',

  'Knowledgeable friend who has done the research. Warm but not chatty. '
  'Practical, never salesy. Confident enough to make a clear recommendation, '
  'honest enough to name each option''s weakness.',

  'Grade 8-9. Plain language. Explain any financial term on first use.',

  'Second person "you" for the reader. First person plural "we" for our own '
  'view — "here''s how we think about it", "our overall pick".',

  'Alternate short and long. A long explanatory sentence, then a short one '
  'that lands the point. Never three long sentences in a row.',

  true,   -- contractions: yes, constantly
  true,   -- em dashes: part of the voice, do not strip

  'Conversational headings, never keyword headings. One section per option '
  'compared, then a comparison section, then a recommendation section. '
  'Byline format: "Reviewed by the ScholarRoads research team · Updated [Month Year]".',

  'Real examples from published work: "Head-to-head: the rates", '
  '"So which should you pick?". Never "Introduction", "Conclusion", "Overview".',

  'Open with the reader''s actual decision, framed honestly. '
  '"It really comes down to what you value most." No dictionary definitions, '
  'no "in today''s world", no throat-clearing.',

  'No hard sell. Close by telling the reader to compare their own actual '
  'offers, not to apply. "Check both and compare your actual offers before '
  'you decide."',

  array[
    'leverage','synergy','delve','landscape','unlock','elevate',
    'in today''s fast-paced world','navigate the complexities',
    'game-changer','revolutionary','best-in-class','seamless',
    'empower','robust','cutting-edge','it''s important to note',
    'dive into','when it comes to','at the end of the day'
  ],

  array[
    'Byline with Updated month and year',
    'Federal-aid-first paragraph, placed early, before any private lender is described',
    'Affiliate disclosure at the end',
    'Not-a-financial-advisor line',
    'A clear recommendation — do not hedge into uselessness',
    'Every compared brand''s real weakness named'
  ],

  'Never imply guaranteed approval, guaranteed savings, or a guaranteed rate. '
  'Never give personalised advice about the reader''s own finances. '
  'Never use an unscoped superlative — say "the most flexible of any lender '
  'we reviewed", not "the most flexible lender".',

  900
)
on conflict (site_id) do update set
  tone               = excluded.tone,
  reading_level      = excluded.reading_level,
  person             = excluded.person,
  sentence_rhythm    = excluded.sentence_rhythm,
  use_contractions   = excluded.use_contractions,
  use_em_dashes      = excluded.use_em_dashes,
  structure_rules    = excluded.structure_rules,
  heading_style      = excluded.heading_style,
  opening_style      = excluded.opening_style,
  cta_style          = excluded.cta_style,
  banned_words       = excluded.banned_words,
  mandatory_elements = excluded.mandatory_elements,
  must_avoid         = excluded.must_avoid,
  typical_word_count = excluded.typical_word_count,
  updated_at         = now();


-- ------------------------------------------------------------
-- 2. brands — College Ave
--
-- SOURCE: facts taken only from the published ScholarRoads
-- article. Nothing invented.
--
-- No specific rates stored. Rates go stale within weeks and
-- a stale rate in a published article is a real problem.
-- ------------------------------------------------------------
insert into brands (
  name, vertical, website, what_they_are,
  strengths, weaknesses, eligibility, product_range, rate_note,
  disclosure_text, last_verified_at, verified_by, active
) values (
  'College Ave',
  'Student Lending',
  'https://www.collegeave.com',

  'An online student loan portal. Arranges loans and financial services '
  'through several partner banks — it lines up the lending rather than '
  'lending the money itself.',

  array[
    'Four different ways to repay — the most repayment flexibility of any lender ScholarRoads reviewed',
    'Choose your own repayment term',
    'Loans tailored to field of study — undergrad, grad, med, law, MBA, dental',
    'Option to pay while still in school to cut total cost',
    'Prequalify with a soft credit check — real rates visible without a hard pull',
    'Rate check takes about three minutes',
    'Refinancing available for existing student debt'
  ],

  array[
    'Not a direct lender — loans are arranged through partner banks',
    'Lowest advertised variable rate has at times sat slightly above Sallie Mae''s',
    'Less established name than Sallie Mae'
  ],

  'Generally must be at least 16, hold a Social Security number, and be '
  'enrolled at an eligible school. Undergraduates and international students '
  'typically need a creditworthy cosigner.',

  'From $1,000 up to the full certified cost of attendance. Fixed and '
  'variable rates. Refinancing also offered.',

  'Offers both fixed and variable rates. Rates move constantly and depend on '
  'the borrower''s or cosigner''s credit. Never state a specific rate unless '
  'it is supplied in the assignment brief, dated, and qualified.',

  'ScholarRoads earns a commission if you apply through our links, at no '
  'extra cost to you. It never changes our honest take — see our Advertiser '
  'Disclosure. We''re a comparison guide, not a lender or a financial advisor.',

  '2026-08-01',
  'ScholarRoads research team',
  true
)
on conflict (name) do update set
  what_they_are    = excluded.what_they_are,
  strengths        = excluded.strengths,
  weaknesses       = excluded.weaknesses,
  eligibility      = excluded.eligibility,
  product_range    = excluded.product_range,
  rate_note        = excluded.rate_note,
  last_verified_at = excluded.last_verified_at,
  updated_at       = now();


-- ------------------------------------------------------------
-- 3. brands — Sallie Mae
-- ------------------------------------------------------------
insert into brands (
  name, vertical, website, what_they_are,
  strengths, weaknesses, eligibility, product_range, rate_note,
  disclosure_text, last_verified_at, verified_by, active
) values (
  'Sallie Mae',
  'Student Lending',
  'https://www.salliemae.com',

  'One of the most established student lenders in the US. Started as a '
  'federal student lender in the 1970s and is now a private lender.',

  array[
    'Lending to students since the 1970s — one of the most established names',
    'Lowest advertised variable rate has at times sat slightly below College Ave''s',
    'Covers undergrad, grad, and career/trade loans',
    'Funds part-time and international students',
    'Well regarded for customer support',
    'Financial-literacy tools and scholarship programmes',
    'Deferred and interest-only payment options while in school',
    'Rate check available with no impact to credit before formal application'
  ],

  array[
    'Fewer repayment and term choices than College Ave — three ways to repay instead of four',
    'Loans are not tailored to the borrower''s specific field of study',
    'Less flexibility overall'
  ],

  'Loan cannot exceed the school''s certified cost of attendance. '
  'A cosigner can help secure a lower rate.',

  'Undergraduate, graduate, and career/trade loans. Part-time and '
  'international students supported. Fixed and variable rates.',

  'Offers both fixed and variable rates. Rates move constantly and depend on '
  'the borrower''s or cosigner''s credit. Never state a specific rate unless '
  'it is supplied in the assignment brief, dated, and qualified.',

  'ScholarRoads earns a commission if you apply through our links, at no '
  'extra cost to you. It never changes our honest take — see our Advertiser '
  'Disclosure. We''re a comparison guide, not a lender or a financial advisor.',

  '2026-08-01',
  'ScholarRoads research team',
  true
)
on conflict (name) do update set
  what_they_are    = excluded.what_they_are,
  strengths        = excluded.strengths,
  weaknesses       = excluded.weaknesses,
  eligibility      = excluded.eligibility,
  product_range    = excluded.product_range,
  rate_note        = excluded.rate_note,
  last_verified_at = excluded.last_verified_at,
  updated_at       = now();


-- ------------------------------------------------------------
-- 4. rubrics — standard (HME Technologies)
--
-- Keyed on content_profile, not site. New sites inherit
-- automatically.
-- ------------------------------------------------------------
insert into rubrics (content_profile, version, criteria, hard_fail_rules, pass_threshold, active)
values (
  'standard', 1,
  '[
    {"name":"factual_safety","weight":20,
     "scale_1":"Invented statistics, fake sources, made-up figures",
     "scale_5":"No unverifiable claims; every specific is checkable or clearly framed as general"},
    {"name":"brand_voice","weight":20,
     "scale_1":"Generic AI voice, wrong register",
     "scale_5":"Indistinguishable from the site''s example posts"},
    {"name":"structure","weight":15,
     "scale_1":"Wall of text or arbitrary headings",
     "scale_5":"Clear H2s, scannable, logical flow"},
    {"name":"readability","weight":15,
     "scale_1":"Jargon, long clauses, corporate filler",
     "scale_5":"Matches target reading level, short sentences"},
    {"name":"keyword_usage","weight":15,
     "scale_1":"Stuffed, or missing entirely",
     "scale_5":"Natural, present in title, first 100 words and at least one H2"},
    {"name":"originality","weight":15,
     "scale_1":"Generic listicle anyone could write",
     "scale_5":"Specific angle with real examples"}
  ]'::jsonb,
  '[
    "factual_safety scored below 4",
    "any statistic, date, price or named source that was not supplied in the assignment brief"
  ]'::jsonb,
  75, true
)
on conflict (content_profile, version) do update set
  criteria        = excluded.criteria,
  hard_fail_rules = excluded.hard_fail_rules,
  pass_threshold  = excluded.pass_threshold;


-- ------------------------------------------------------------
-- 5. rubrics — ymyl_finance (ScholarRoads, Fuel Business Capital)
--
-- YMYL = "Your Money or Your Life". Held to a higher standard
-- because a wrong claim about a loan term causes real harm.
-- ------------------------------------------------------------
insert into rubrics (content_profile, version, criteria, hard_fail_rules, pass_threshold, active)
values (
  'ymyl_finance', 1,
  '[
    {"name":"figure_hygiene","weight":25,
     "scale_1":"Bare or invented figures",
     "scale_5":"Every number is dated, qualified for who receives it, approximated with about/from, and points the reader to the provider''s own site"},
    {"name":"mandatory_elements","weight":20,
     "scale_1":"Affiliate disclosure or federal-aid-first paragraph missing",
     "scale_5":"All required elements present and correctly placed"},
    {"name":"comparison_fairness","weight":15,
     "scale_1":"One-sided, reads as an advertisement",
     "scale_5":"Every option compared has its real weakness named"},
    {"name":"brand_voice","weight":15,
     "scale_1":"Generic AI register",
     "scale_5":"Matches the site''s published voice"},
    {"name":"usefulness","weight":10,
     "scale_1":"Hedges into uselessness, gives no answer",
     "scale_5":"Makes a clear recommendation with stated reasoning"},
    {"name":"readability","weight":10,
     "scale_1":"Dense, unexplained financial terms",
     "scale_5":"Grade 8-9, every term explained on first use"},
    {"name":"keyword_usage","weight":5,
     "scale_1":"Stuffed or absent",
     "scale_5":"Natural, in the title and early in the body"}
  ]'::jsonb,
  '[
    "any figure missing a date stamp or a qualifier",
    "any figure the writer invented rather than received in the assignment brief",
    "affiliate disclosure missing",
    "federal-aid-first paragraph missing or buried below the lender sections",
    "guaranteed outcome implied — approval, savings, or a specific rate",
    "a compared brand''s weakness omitted entirely",
    "an unscoped superlative such as the most flexible lender",
    "personalised advice about the reader''s own finances"
  ]'::jsonb,
  85, true
)
on conflict (content_profile, version) do update set
  criteria        = excluded.criteria,
  hard_fail_rules = excluded.hard_fail_rules,
  pass_threshold  = excluded.pass_threshold;


-- ============================================================
-- Verify
-- ============================================================
-- select site_id, tone from brand_profiles;
-- select name, array_length(strengths,1) s, array_length(weaknesses,1) w,
--        last_verified_at from brands;
-- select content_profile, pass_threshold, active from rubrics;