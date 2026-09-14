export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  );
}

export function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <path
        d="M10 2.5 18 16.5H2L10 2.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 8v3.5" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
      style={style}
    >
      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
    >
      <path d="M12.5 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
    >
      <path d="M7.5 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16.5 16.5l-3.8-3.8" strokeLinecap="round" />
    </svg>
  );
}

export function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeWidth={2}
        strokeOpacity={0.25}
      />
      <path
        d="M18 10a8 8 0 0 0-8-8"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <path
        d="M5 2.5h6l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 2.5v4h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 11h7M6.5 14h7M6.5 8h3" strokeLinecap="round" />
    </svg>
  );
}

export function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M2.5 10h15M10 2.5c2.5 2 2.5 13 0 15M10 2.5c-2.5 2-2.5 13 0 15" strokeLinecap="round" />
    </svg>
  );
}

export function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <path d="M2.5 14.5 8 9l3.5 3.5 6-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 6.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <path
        d="M8.5 11.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-1 1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 8.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l1-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function XSocialIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M11.2 8.9 16 3.5h-1.6l-4.1 4.7-3.3-4.7H3l5 7.2-5.2 6h1.6l4.4-5 3.6 5H17l-5.2-7.5Zm-1.6.9-.5-.7L4.9 4.5h1.4l3.2 4.6.5.7 4.4 6.2h-1.4L9.6 9.8Z" />
    </svg>
  );
}

export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <rect x="2.5" y="7.2" width="2.6" height="9" rx="0.4" />
      <circle cx="3.8" cy="4" r="1.6" />
      <path d="M8 7.2h2.5v1.3c.5-.8 1.4-1.5 2.9-1.5 3.1 0 3.6 2 3.6 4.6v5.6h-2.6v-5c0-1.2 0-2.7-1.7-2.7s-1.9 1.3-1.9 2.6v5.1H8V7.2Z" />
    </svg>
  );
}

export function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M3 5.5l7 5.5 7-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
    >
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      <path
        d="M12.9 3.5l3.6 3.6-9.3 9.3-4.1.5.5-4.1 9.3-9.3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
