"use client";

import type { Site } from "@/types";

// Inline "which site?" prompt shown beside a chart the moment it expands
// on hover -- real sites only (from the sites prop passed down from the
// server-fetched data), never a hardcoded list, so a new site shows up
// here automatically.
export function SitePicker({
  sites,
  onPick,
}: {
  sites: Site[];
  onPick: (siteId: string) => void;
}) {
  return (
    <div className="spotlight-site-picker">
      <div className="spotlight-site-picker-title">Show data for which site?</div>
      <div className="spotlight-site-picker-options">
        {sites.map((site) => (
          <button
            key={site.id}
            type="button"
            className="spotlight-site-picker-btn"
            onClick={() => onPick(site.id)}
          >
            {site.name}
          </button>
        ))}
      </div>

      <style jsx>{`
        .spotlight-site-picker {
          width: 100%;
          max-width: 260px;
          min-width: 200px;
          flex: 1 1 220px;
          background: #191d24;
          border: 1px solid #262b33;
          border-radius: 10px;
          padding: 16px;
          opacity: 0;
          animation: spotlight-fade-in 0.25s ease forwards;
        }
        @keyframes spotlight-fade-in {
          to {
            opacity: 1;
          }
        }
        .spotlight-site-picker-title {
          font-size: 13px;
          color: #8a919c;
          margin-bottom: 10px;
        }
        .spotlight-site-picker-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .spotlight-site-picker-btn {
          text-align: left;
          background: #232830;
          border: 1px solid #313842;
          color: #eef0f2;
          font-size: 14px;
          font-weight: 500;
          padding: 9px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition:
            border-color 0.15s,
            background 0.15s;
        }
        .spotlight-site-picker-btn:hover {
          border-color: #4fd1a5;
          background: #1d232b;
        }
      `}</style>
    </div>
  );
}
