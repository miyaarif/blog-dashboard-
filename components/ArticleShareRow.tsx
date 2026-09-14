"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import {
  CheckIcon,
  LinkIcon,
  LinkedInIcon,
  MailIcon,
  XSocialIcon,
} from "@/components/icons";

interface ArticleShareRowProps {
  url: string;
  title: string;
  accentColor: string;
}

const BUTTON_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-muted transition-all hover:-translate-y-0.5 hover:text-[color:var(--share-accent)] hover:border-[color:var(--share-accent)]";

export default function ArticleShareRow({
  url,
  title,
  accentColor,
}: ArticleShareRowProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing to
      // recover into, the click just does nothing.
    }
  }

  return (
    <div
      className="mt-4 flex items-center gap-2"
      style={{ "--share-accent": accentColor } as CSSProperties}
    >
      <button
        type="button"
        onClick={handleCopy}
        className={BUTTON_CLASS}
        aria-label="Copy link"
        title={copied ? "Copied!" : "Copy link"}
      >
        {copied ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <LinkIcon className="h-4 w-4" />
        )}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={BUTTON_CLASS}
        aria-label="Share on X"
      >
        <XSocialIcon className="h-4 w-4" />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={BUTTON_CLASS}
        aria-label="Share on LinkedIn"
      >
        <LinkedInIcon className="h-4 w-4" />
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}
        className={BUTTON_CLASS}
        aria-label="Share by email"
      >
        <MailIcon className="h-4 w-4" />
      </a>
    </div>
  );
}
