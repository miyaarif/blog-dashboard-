"use client";

import { useEffect, useRef, useState } from "react";

const LOAD_TIMEOUT_MS = 6000;

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
//
// onError alone isn't enough: some hosts (seen with picsum.photos here)
// accept the connection and then never respond at all, rather than
// failing cleanly. That never fires 'error' — the <img> just sits pending
// forever. A load timeout catches that case too, not just clean failures.
//
// Keyed by src so a changed src remounts a fresh instance (fresh failed
// state, fresh timeout) instead of resetting state inside an effect.
export default function HeroImage(props: HeroImageProps) {
  return <HeroImageForSrc key={props.src ?? "none"} {...props} />;
}

function HeroImageForSrc({
  src,
  alt,
  className,
  fallbackClassName,
  fallback = "box",
}: HeroImageProps) {
  const [failed, setFailed] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!src) return;

    const timeoutId = setTimeout(() => {
      if (!loadedRef.current) setFailed(true);
    }, LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [src]);

  if (!src || failed) {
    if (fallback === "hidden") return null;
    return <div className={fallbackClassName ?? className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onLoad={() => {
        loadedRef.current = true;
      }}
      onError={() => setFailed(true)}
    />
  );
}
