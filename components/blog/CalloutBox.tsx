// Shared "gray box + icon + colored bottom border" pattern used by every
// structured section that has one (quick-answer, key takeaways, and any
// future how-to box) — built once here instead of copy-pasted per variant.
import type { ReactNode } from "react";

type CalloutVariant = "quick-answer" | "key-takeaways" | "how-to";

const VARIANT_TITLE: Record<CalloutVariant, string> = {
  "quick-answer": "In a hurry?",
  "key-takeaways": "Key takeaways",
  "how-to": "How to",
};

function CalloutIcon({ variant }: { variant: CalloutVariant }) {
  if (variant === "key-takeaways") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}

interface CalloutBoxProps {
  variant: CalloutVariant;
  accentColour: string;
  children: ReactNode;
}

export default function CalloutBox({
  variant,
  accentColour,
  children,
}: CalloutBoxProps) {
  return (
    <div
      className="rounded-lg bg-card p-5"
      style={{ borderBottom: `3px solid ${accentColour}` }}
    >
      <div
        className="mb-2 flex items-center gap-2 text-sm font-semibold"
        style={{ color: accentColour }}
      >
        <CalloutIcon variant={variant} />
        {VARIANT_TITLE[variant]}
      </div>
      <div className="prose prose-sm max-w-none text-ink dark:prose-invert">
        {children}
      </div>
    </div>
  );
}
