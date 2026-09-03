"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // localStorage can throw in private-browsing contexts — the toggle
    // still works for the session, it just won't persist.
  }
}

// Reads the real DOM state set by the no-FOUC inline script in
// app/layout.tsx, rather than re-deciding the theme itself — avoids a
// mismatch between what that script picked and what this renders.
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (isDark === null) {
    return <div className="h-8 w-[104px] rounded-full bg-card" aria-hidden />;
  }

  return (
    <div className="inline-flex items-center rounded-full border border-line bg-page p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => {
          setIsDark(false);
          applyTheme(false);
        }}
        aria-pressed={!isDark}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 transition-colors ${
          !isDark ? "bg-card text-ink shadow-sm" : "text-muted"
        }`}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => {
          setIsDark(true);
          applyTheme(true);
        }}
        aria-pressed={isDark}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 transition-colors ${
          isDark ? "bg-card text-ink shadow-sm" : "text-muted"
        }`}
      >
        Dark
      </button>
    </div>
  );
}
