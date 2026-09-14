"use client";

// Inline sibling of SpotlightOverlay's info panel -- same dark reference
// palette and typewriter/caret treatment, but laid out as a normal
// in-page element beside the expanded chart instead of a fixed,
// backdrop-blurred takeover. Used once a site has been picked.
export function SpotlightSidePanel({
  title,
  typedText,
  isTypingDone,
  isPinned,
  onResume,
  actionLabel,
  onAction,
  onChangeSite,
}: {
  title: string;
  typedText: string;
  isTypingDone: boolean;
  isPinned: boolean;
  onResume: () => void;
  actionLabel?: string;
  onAction?: () => void;
  onChangeSite: () => void;
}) {
  return (
    <div className="spotlight-side-panel">
      <div className="spotlight-side-panel-title">{title}</div>
      <div className="spotlight-side-panel-text">
        {typedText.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
        {!isTypingDone && <span className="spotlight-side-caret" />}
      </div>
      {isPinned && actionLabel && onAction && (
        <button type="button" className="spotlight-side-action" onClick={onAction}>
          {actionLabel} →
        </button>
      )}
      {isPinned && (
        <div className="spotlight-side-pinned-tag">
          Pinned —{" "}
          <b onClick={onResume}>resume auto-play</b>
        </div>
      )}
      <button type="button" className="spotlight-side-change-site" onClick={onChangeSite}>
        Change site
      </button>

      <style jsx>{`
        .spotlight-side-panel {
          width: 100%;
          max-width: 260px;
          min-width: 200px;
          flex: 1 1 220px;
          background: #191d24;
          border: 1px solid #262b33;
          border-radius: 10px;
          padding: 16px;
          opacity: 0;
          animation: spotlight-side-fade-in 0.3s ease 0.1s forwards;
        }
        @keyframes spotlight-side-fade-in {
          to {
            opacity: 1;
          }
        }
        .spotlight-side-panel-title {
          font-size: 17px;
          font-weight: 600;
          color: #ffb454;
          margin: 0 0 12px;
        }
        .spotlight-side-panel-text {
          font-size: 14px;
          line-height: 1.6;
          color: #eef0f2;
          min-height: 80px;
        }
        .spotlight-side-caret {
          display: inline-block;
          width: 2px;
          height: 14px;
          background: #eef0f2;
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: spotlight-side-blink 1s step-start infinite;
        }
        @keyframes spotlight-side-blink {
          50% {
            opacity: 0;
          }
        }
        .spotlight-side-action {
          display: block;
          margin-top: 14px;
          background: transparent;
          border: none;
          padding: 0;
          font-size: 12px;
          font-weight: 600;
          color: #4fd1a5;
          cursor: pointer;
        }
        .spotlight-side-action:hover {
          text-decoration: underline;
        }
        .spotlight-side-pinned-tag {
          font-size: 11px;
          color: #8a919c;
          margin-top: 12px;
        }
        .spotlight-side-pinned-tag b {
          color: #4fd1a5;
          cursor: pointer;
        }
        .spotlight-side-change-site {
          display: block;
          margin-top: 18px;
          background: transparent;
          border: none;
          padding: 0;
          font-size: 11px;
          color: #8a919c;
          cursor: pointer;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
