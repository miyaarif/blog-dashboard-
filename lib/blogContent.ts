// Parses the real writer-prompt convention out of body_markdown.
// Convention (supabase/migrations/20260902_writer_prompt_v4_no_unverified_brands.sql,
// rules 8-11): body_markdown = [quick-answer block, no heading] then a
// literal "## Key takeaways" section, then normal H2/H3 sections, then a
// literal "## FAQ" section near the end. Both special headings use those
// exact labels — a conversational rewrite of them is a writer mistake, not
// a variant to also match, so this checks for the literal text only.
//
// As of 2026-09-03, zero real published articles have any of these three
// sections (they predate the prompt version that introduced them) — every
// article in production runs through the "not present" branch below, and
// that's expected, not a bug.

export interface ArticleSection {
  heading: string;
  level: 2 | 3;
  content: string;
}

export interface ParsedArticleBody {
  quickAnswer: string | null;
  keyTakeaways: string | null;
  faq: string | null;
  sections: ArticleSection[];
}

interface HeadingMatch {
  index: number;
  level: 2 | 3;
  text: string;
}

function findHeadings(lines: string[]): HeadingMatch[] {
  const headings: HeadingMatch[] = [];
  lines.forEach((line, index) => {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      headings.push({ index, level: 2, text: h2[1].trim() });
      return;
    }
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      headings.push({ index, level: 3, text: h3[1].trim() });
    }
  });
  return headings;
}

// Until this was fixed at the source (brand_profiles + writer/reviser
// prompts), the model was instructed to write a "Reviewed by [team] ·
// Updated [date]" line as literal body text — a fabricated human-review
// claim, since reviewed_by is null on every real article. That
// instruction is gone for new content, but existing stored
// drafts/articles already contain the line as text, so this strips it
// at render time rather than requiring every article to be regenerated.
// The real reviewer name and date are rendered separately by
// AuthorByline from the real reviewed_by/last_updated columns.
function stripFabricatedByline(bodyMarkdown: string): string {
  return bodyMarkdown
    .replace(/^.*\breviewed by\b.*\bupdated\b.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function parseArticleBody(rawBodyMarkdown: string): ParsedArticleBody {
  const bodyMarkdown = stripFabricatedByline(rawBodyMarkdown);
  const lines = bodyMarkdown.replace(/\r\n/g, "\n").split("\n");
  const headings = findHeadings(lines);

  const quickAnswerText = lines
    .slice(0, headings.length > 0 ? headings[0].index : lines.length)
    .join("\n")
    .trim();

  const sections: ArticleSection[] = [];
  let keyTakeaways: string | null = null;
  let faq: string | null = null;

  headings.forEach((heading, i) => {
    const start = heading.index + 1;
    const end = i + 1 < headings.length ? headings[i + 1].index : lines.length;
    const content = lines.slice(start, end).join("\n").trim();

    if (heading.level === 2 && heading.text === "Key takeaways") {
      keyTakeaways = content.length > 0 ? content : null;
    } else if (heading.level === 2 && heading.text === "FAQ") {
      faq = content.length > 0 ? content : null;
    } else {
      sections.push({ heading: heading.text, level: heading.level, content });
    }
  });

  return {
    quickAnswer: quickAnswerText.length > 0 ? quickAnswerText : null,
    keyTakeaways,
    faq,
    sections,
  };
}

// Matches the anchor ids assigned to real headings in ArticleMarkdown so
// the table of contents links actually land on the right section.
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// FAQPage JSON-LD extraction (Fix 7). Real writer convention (writer
// prompt rules 10-11): each question is a WHOLE line wrapped in
// **bold**, ending in "?". Confirmed across 11 real generated articles
// -- zero deviations on the question format itself. Two real
// variants exist for question-to-answer spacing (a single line break,
// or a blank line in between) -- both handled by skipping leading
// blank lines before capturing.
//
// Deliberately captures only the FIRST paragraph after each question,
// never "everything up to the next question or end of section". Two
// real cases (art_0116, art_0126) have a compliance disclaimer --
// sometimes preceded by a "---" rule, sometimes not -- sitting right
// after the last real answer with no heading of its own. Every real
// answer checked is a single paragraph, so bounding each answer at the
// first blank line naturally excludes that trailing boilerplate
// instead of gluing it onto the last real answer.
const FAQ_QUESTION_LINE = /^\*\*(.+\?)\*\*$/;

export interface FaqPair {
  question: string;
  answer: string;
}

export function extractFaqPairs(faqSection: string): FaqPair[] {
  const lines = faqSection.replace(/\r\n/g, "\n").split("\n");
  const pairs: FaqPair[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(FAQ_QUESTION_LINE);
    if (!match) continue;

    const question = stripMarkdown(match[1]);

    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;

    const answerLines: string[] = [];
    while (
      j < lines.length &&
      lines[j].trim() !== "" &&
      !FAQ_QUESTION_LINE.test(lines[j].trim())
    ) {
      answerLines.push(lines[j].trim());
      j++;
    }

    const answer = stripMarkdown(answerLines.join(" "));
    if (question.length > 0 && answer.length > 0) {
      pairs.push({ question, answer });
    }
  }

  return pairs;
}

// Real first paragraph of the article's opening (the quick-answer block
// when present, otherwise whatever comes before the first heading), not
// meta_description — meta_description is inconsistent in real data (empty
// on some published articles, just the title restated on others).
export function deriveExcerpt(bodyMarkdown: string, maxLength = 150): string {
  const { quickAnswer } = parseArticleBody(bodyMarkdown);
  const source = quickAnswer ?? bodyMarkdown;
  const firstParagraph = source.split(/\n\s*\n/)[0] ?? "";
  const plain = stripMarkdown(firstParagraph);

  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}
