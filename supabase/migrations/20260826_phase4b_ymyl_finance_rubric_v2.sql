-- Phase 4b: ymyl_finance rubric v2
-- Fixes: readability under-weighted (a 2/5 barely moved the total),
-- and no hard-fail rule caught a heading promising info the section
-- didn't deliver. v1 stays in the table, deactivated, never overwritten.

begin;

-- must deactivate v1 first: rubrics_one_active allows only one active row per content_profile
update rubrics
set active = false
where content_profile = 'ymyl_finance' and version = 1;

insert into rubrics (id, content_profile, version, criteria, hard_fail_rules, pass_threshold, active, created_at)
values (
  'rubric_ymyl_finance_v2',
  'ymyl_finance',
  2,
  '[
    {"name": "figure_hygiene", "weight": 25, "scale_1": "Bare or invented figures", "scale_5": "Every number is dated, qualified for who receives it, approximated with about/from, and points the reader to the provider''s own site"},
    {"name": "mandatory_elements", "weight": 20, "scale_1": "Affiliate disclosure or federal-aid-first paragraph missing", "scale_5": "All required elements present and correctly placed"},
    {"name": "readability", "weight": 20, "scale_1": "Dense, unexplained financial terms", "scale_5": "Grade 8-9, every term explained on first use"},
    {"name": "comparison_fairness", "weight": 10, "scale_1": "One-sided, reads as an advertisement", "scale_5": "Every option compared has its real weakness named"},
    {"name": "brand_voice", "weight": 10, "scale_1": "Generic AI register", "scale_5": "Matches the site''s published voice"},
    {"name": "usefulness", "weight": 10, "scale_1": "Hedges into uselessness, gives no answer", "scale_5": "Makes a clear recommendation with stated reasoning"},
    {"name": "keyword_usage", "weight": 5, "scale_1": "Stuffed or absent", "scale_5": "Natural, in the title and early in the body"}
  ]'::jsonb,
  '[
    "any figure missing a date stamp or a qualifier",
    "any figure the writer invented rather than received in the assignment brief",
    "affiliate disclosure missing",
    "federal-aid-first paragraph missing or buried below the lender sections",
    "guaranteed outcome implied — approval, savings, or a specific rate",
    "a compared brand''s weakness omitted entirely",
    "an unscoped superlative such as the most flexible lender",
    "personalised advice about the reader''s own finances",
    "a section heading promises information the section does not deliver",
    "word count more than 15% below target",
    "any single criterion score of 2 or below"
  ]'::jsonb,
  85,
  true,
  now()
);

commit;

-- Verify after running:
-- select version, active, pass_threshold from rubrics where content_profile = 'ymyl_finance' order by version;
-- select id, jsonb_pretty(criteria) from rubrics where id = 'rubric_ymyl_finance_v2';
