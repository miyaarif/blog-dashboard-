"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { getArticles, getSites } from "@/lib/sites";
import { getArticleWithEdits, saveArticle } from "@/lib/storage";
import { scoreArticle } from "@/lib/scoring/score";
import { checkPublishGate } from "@/lib/scoring/publishGate";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CharCounter from "@/components/CharCounter";
import type { Article } from "@/types";

export default function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const original = getArticles().find((a) => a.id === id);
  const sites = getSites();

  const [article, setArticle] = useState<Article | null>(null);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (original) {
      setArticle(getArticleWithEdits(original.id, original));
    }
  }, [original]);

  if (!original || !article) {
    return <div style={{ padding: 24 }}>Article not found.</div>;
  }

  const currentSite = sites.find((s) => s.id === article.site_id)!;
  const { score, reasons } = scoreArticle(article, currentSite);

  const allArticles = getArticles();
  const gate = checkPublishGate(article, currentSite, allArticles);

  function update(field: keyof Article, value: string) {
    setArticle((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleSave() {
    saveArticle(article);
    setSavedMessage("Saved");
    setTimeout(() => setSavedMessage(""), 2000);
  }

  return (
    <div style={{ padding: 24, display: "flex", gap: 24 }}>
      <div style={{ flex: 1 }}>
        <label>Site</label>
        <select
          value={article.site_id}
          onChange={(e) => update("site_id", e.target.value)}
          style={{ display: "block", marginBottom: 16, width: "100%" }}
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label>Title</label>
        <input
          value={article.title}
          onChange={(e) => update("title", e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 4 }}
        />
        <CharCounter value={article.title} min={50} max={60} />

        <label style={{ display: "block", marginTop: 16 }}>
          Meta description
        </label>
        <input
          value={article.meta_description}
          onChange={(e) => update("meta_description", e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 4 }}
        />
        <CharCounter value={article.meta_description} min={120} max={158} />

        <label style={{ display: "block", marginTop: 16 }}>
          Body (markdown)
        </label>
        <textarea
          value={article.body_markdown}
          onChange={(e) => update("body_markdown", e.target.value)}
          rows={20}
          style={{ display: "block", width: "100%", fontFamily: "monospace" }}
        />

        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #333",
            borderRadius: 6,
          }}
        >
          <strong>Score: {score} / 100</strong>
          {reasons.length > 0 && (
            <ul style={{ marginTop: 8 }}>
              {reasons.map((r, i) => (
                <li key={i} style={{ fontSize: 13, color: "#dc2626" }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #333",
            borderRadius: 6,
          }}
        >
          <strong>
            {gate.canPublish ? "Ready to publish" : "Blocked from publishing"}
          </strong>
          {!gate.canPublish && (
            <ul style={{ marginTop: 8 }}>
              {gate.reasons.map((r, i) => (
                <li key={i} style={{ fontSize: 13, color: "#dc2626" }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
          <button disabled={!gate.canPublish} style={{ marginTop: 8 }}>
            Publish
          </button>
        </div>

        <button onClick={handleSave} style={{ marginTop: 12 }}>
          Save
        </button>
        {savedMessage && <span style={{ marginLeft: 8 }}>{savedMessage}</span>}
      </div>

      <div style={{ flex: 1, borderLeft: "1px solid #333", paddingLeft: 24 }}>
        <h2>{article.title}</h2>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {article.body_markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
