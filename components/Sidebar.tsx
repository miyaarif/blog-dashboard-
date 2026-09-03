"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, CloseIcon, ChevronDownIcon } from "@/components/icons";
import ThemeToggle from "@/components/ThemeToggle";
import type { Site } from "@/types";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/articles", label: "Articles" },
  { href: "/calendar", label: "Calendar" },
  { href: "/keywords", label: "Keywords" },
  { href: "/create", label: "Create" },
  { href: "/review-queue", label: "Review queue" },
];

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "text-muted hover:bg-accent-soft hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function BlogSection({
  sites,
  isBlogActive,
  onNavigate,
}: {
  sites: Site[];
  isBlogActive: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(isBlogActive);

  if (sites.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isBlogActive
            ? "bg-accent text-white"
            : "text-muted hover:bg-accent-soft hover:text-ink"
        }`}
      >
        Blog
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-0.5 pl-3">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/blog?site=${site.id}`}
              onClick={onNavigate}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-ink"
            >
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: site.primary_colour }}
              />
              {site.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  sites,
  pathname,
  onNavigate,
}: {
  sites: Site[];
  pathname: string;
  onNavigate?: () => void;
}) {
  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2 px-5 py-5 text-sm font-semibold text-ink"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
          B
        </span>
        Blog Dashboard
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {LINKS.map((link) => (
          <NavLink
            key={link.href}
            href={link.href}
            label={link.label}
            active={isActive(link.href)}
            onClick={onNavigate}
          />
        ))}
        <BlogSection
          sites={sites}
          isBlogActive={pathname.startsWith("/blog")}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="border-t border-line p-4">
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function Sidebar({ sites }: { sites: Site[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Desktop: fixed sidebar, always visible */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-card sm:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent sites={sites} pathname={pathname} />
        </div>
      </aside>

      {/* Mobile: slim top bar + slide-in drawer */}
      <header className="flex items-center justify-between border-b border-line bg-card px-4 py-3 sm:hidden">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
            B
          </span>
          Blog Dashboard
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-accent-soft"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={drawerRef}
            className="absolute left-0 top-0 h-full w-64 bg-card shadow-xl"
          >
            <div className="flex items-center justify-end px-3 pt-3">
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-accent-soft"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              sites={sites}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
