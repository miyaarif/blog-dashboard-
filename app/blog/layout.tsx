// The public blog keeps each real site's own brand identity and always
// renders light, independent of the internal dashboard's dark-mode toggle
// (a decision made earlier this project: /blog, the calendar poster, and
// hero images are 3 real businesses' branding, not this tool's UI).
// Without this, /blog/page.tsx and /blog/[slug]/page.tsx inherit bg-page
// and text-ink from the root layout, which flip dark with the dashboard's
// theme toggle — but their own content uses hardcoded light-mode classes
// (text-gray-900, prose without dark:prose-invert, etc.), so dark mode
// left the text unreadable against the leaked dark background.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-white text-[#0F172A]">{children}</div>;
}
