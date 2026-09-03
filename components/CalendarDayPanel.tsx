"use client";

import { useEffect } from "react";
import Link from "next/link";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import { CloseIcon, EyeIcon, PencilIcon } from "@/components/icons";
import type { Article, Site } from "@/types";

function formatDateHeading(dateKey: string): string {
  return new Date(dateKey + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function CalendarDayPanel({
  date,
  articles,
  sites,
  onClose,
}: {
  date: string | null;
  articles: Article[];
  sites: Site[];
  onClose: () => void;
}) {
  const isOpen = date !== null;
  const sitesById = new Map(sites.map((s) => [s.id, s]));

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/20 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        className={`fixed right-0 top-0 z-40 h-full w-full max-w-sm transform bg-card shadow-xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-hidden={!isOpen}
      >
        {date && (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-line p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {articles.length} {articles.length === 1 ? "article" : "articles"}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold text-ink">
                  {formatDateHeading(date)}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1.5 text-muted hover:bg-accent-soft hover:text-ink"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <Link
                href={`/editor/new?date=${date}`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                + Add new article for this day
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 px-5">
              {articles.map((a) => {
                const site = sitesById.get(a.site_id);
                return (
                  <div key={a.id} className="py-4">
                    <div className="flex items-center gap-2">
                      {site && <SiteBadge site={site} />}
                      <StatusPill status={a.status} />
                    </div>
                    <Link
                      href={`/articles/${a.id}`}
                      className="mt-1.5 block font-medium text-ink hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {a.scheduled_for ? "Scheduled" : "Published"} for{" "}
                      {formatDateHeading(date)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        href={`/articles/${a.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        Read
                      </Link>
                      <Link
                        href={`/editor/${a.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </div>
                  </div>
                );
              })}
              {articles.length === 0 && (
                <p className="py-8 text-center text-sm text-muted">
                  Nothing scheduled or published this day.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
