-- ------------------------------------------------------------
-- Grader JSON-parse failure capture.
-- Real problem: 5 historical loop_runs failed with "DeepSeek grader did
-- not return valid, complete JSON after one retry" (Sept 2026) and left
-- nothing behind but a console.warn line -- gone once the terminal/Vercel
-- log rolled over. None were diagnosable afterward: no raw response, no
-- finish_reason, no per-call token usage survived anywhere.
--
-- jsonb array, one entry per failed grader call within the run (attempt 1
-- and, if it also fails, the one retry) -- matches the existing pattern
-- for structured per-item data in this schema (grades.issues,
-- brand_profiles.terminology) rather than a flat set of columns, since a
-- run can have 0, 1, or 2 of these entries. Null on every normal run --
-- this is diagnostic data for a failure, not something every row carries.
--
-- Each entry: { attempt, finish_reason, input_tokens, output_tokens,
-- content, reasoning_content, captured_at }. finish_reason is DeepSeek's
-- own field (confirmed against their API docs) -- "length" means the
-- output hit GRADER_MAX_TOKENS or the context window mid-response;
-- anything else means generation finished normally but produced
-- malformed or wrong-shape JSON. That distinction is exactly what was
-- missing to diagnose the 5 historical failures.
-- ------------------------------------------------------------
alter table loop_runs add column if not exists grader_parse_failures jsonb default null;

comment on column loop_runs.grader_parse_failures is
  'Diagnostic capture for a grader JSON-parse failure -- [{attempt, finish_reason, input_tokens, output_tokens, content, reasoning_content, captured_at}], one entry per failed grader call in this run (attempt 1, and the retry if it also failed). Null on every run where the grader parsed cleanly. See captureGraderParseFailure() in lib/pipelineShared.ts.';
