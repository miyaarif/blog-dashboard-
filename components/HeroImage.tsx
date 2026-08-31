"use client";

import { useState } from "react";

interface HeroImageProps {
  src: string | null;
  alt: string;
  className: string;
  fallbackClassName?: string;
  // "box": show a placeholder box on failure (thumbnails, where the space
  // is always reserved). "hidden": render nothing on failure (the full
  // hero banner, matching how it already renders nothing when there's no
  // URL at all).
  fallback?: "box" | "hidden";
}

// Plain <img>, not next/image — hero_image_url points at external, often
// unconfigured domains, and this only needs a runtime failure fallback,
// not responsive srcset generation.
export default function HeroImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallback = "box",
}: HeroImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    if (fallback === "hidden") return null;
    return <div className={fallbackClassName ?? className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
