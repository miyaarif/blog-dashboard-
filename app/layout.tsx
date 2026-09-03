import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import { getSites } from "@/lib/sites";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blog Dashboard",
  description: "Internal dashboard for the HME Technology blog network",
};

// Runs before hydration so the page never flashes the wrong theme: reads
// the real stored choice (or OS preference, on a first visit with none
// saved yet) and sets the class before any paint happens. ThemeToggle
// reads this same DOM state back rather than re-deciding it.
const NO_FLASH_THEME_SCRIPT = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sites = await getSites();

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-page text-ink">
        <div className="flex min-h-full flex-col sm:flex-row">
          <Sidebar sites={sites} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
