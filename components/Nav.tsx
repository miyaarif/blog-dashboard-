"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, CloseIcon, ChevronDownIcon } from "@/components/icons";
import type { Site } from "@/types";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/articles", label: "Articles" },
  { href: "/calendar", label: "Calendar" },
  { href: "/keywords", label: "Keywords" },
  { href: "/create", label: "Create" },
  { href: "/review-queue", label: "Review queue" },
];

export default function Nav({ sites }: { sites: Site[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [blogMenuOpen, setBlogMenuOpen] = useState(false);
  const blogMenuRef = useRef<HTMLDivElement>(null);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const isBlogActive = pathname.startsWith("/blog");

  // Real sites, not a hardcoded list — a new site added to the sites
  // table shows up here without a code change.
  useEffect(() => {
    if (!blogMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        blogMenuRef.current &&
        !blogMenuRef.current.contains(event.target as Node)
      ) {
        setBlogMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [blogMenuOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-gray-900"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-900 text-xs font-bold text-white">
            B
          </span>
          Blog Dashboard
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {sites.length > 0 && (
            <div className="relative" ref={blogMenuRef}>
              <button
                type="button"
                onClick={() => setBlogMenuOpen((v) => !v)}
                aria-expanded={blogMenuOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isBlogActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                Blog
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>

              {blogMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {sites.map((site) => (
                    <Link
                      key={site.id}
                      href={`/blog?site=${site.id}`}
                      role="menuitem"
                      onClick={() => setBlogMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {site.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 sm:hidden"
        >
          {open ? (
            <CloseIcon className="h-5 w-5" />
          ) : (
            <MenuIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-gray-100 px-4 py-3 sm:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {sites.length > 0 && (
            <>
              <div className="mt-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Blog
              </div>
              {sites.map((site) => (
                <Link
                  key={site.id}
                  href={`/blog?site=${site.id}`}
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive("/blog")
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {site.name}
                </Link>
              ))}
            </>
          )}
        </nav>
      )}
    </header>
  );
}
