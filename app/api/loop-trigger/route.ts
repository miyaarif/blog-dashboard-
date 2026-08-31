import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface LoopTriggerBody {
  site_id: string;
  title: string;
  target_keyword: string;
  keywords: string[];
  brand_names: string[];
  search_intent: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateBody(body: unknown): { errors: string[]; value: LoopTriggerBody | null } {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { errors: ["Request body must be a JSON object"], value: null };
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.site_id)) errors.push("site_id is required");
  if (!isNonEmptyString(candidate.title)) errors.push("title is required");
  if (!isNonEmptyString(candidate.target_keyword)) errors.push("target_keyword is required");
  if (!isNonEmptyString(candidate.search_intent)) errors.push("search_intent is required");
  if (!isStringArray(candidate.keywords)) errors.push("keywords must be an array of strings");
  if (!isStringArray(candidate.brand_names))
    errors.push("brand_names must be an array of strings (can be empty)");

  if (errors.length > 0) {
    return { errors, value: null };
  }

  return {
    errors: [],
    value: {
      site_id: candidate.site_id as string,
      title: candidate.title as string,
      target_keyword: candidate.target_keyword as string,
      search_intent: candidate.search_intent as string,
      keywords: candidate.keywords as string[],
      brand_names: candidate.brand_names as string[],
    },
  };
}

// Browser-facing trigger for the creation box and Retry. PIPELINE_SECRET
// is read here, server-side, and attached to the internal call to
// /api/loop-run — it never reaches the browser. This route itself has no
// secret check: the same-origin request from the dashboard's own pages is
// the only intended caller, matching the rest of this app's (currently
// login-free) write paths.
export async function POST(request: NextRequest): Promise<NextResponse> {
  // The loop can make up to 6 DeepSeek calls per run and has already been
  // confirmed to outlast Vercel Hobby's ~10s function timeout (seen on
  // /api/grade). Local-only for now, per the Phase 7 decision — enforced
  // here, not just by hiding the button.
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        error:
          "The writer/grader loop is local-only for now — Vercel Hobby's function timeout can't fit up to 6 DeepSeek calls in one request. Run the dashboard locally (npm run dev) to generate or retry an article.",
      },
      { status: 503 },
    );
  }

  const pipelineSecret = process.env.PIPELINE_SECRET;
  if (!pipelineSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: PIPELINE_SECRET is not set" },
      { status: 500 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { errors, value: input } = validateBody(rawBody);
  if (!input) {
    return NextResponse.json({ error: "Invalid input", details: errors }, { status: 400 });
  }

  const loopRunUrl = new URL("/api/loop-run", request.nextUrl.origin);

  let response: Response;
  try {
    response = await fetch(loopRunUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pipeline-secret": pipelineSecret,
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach the loop-run route";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.status });
}
