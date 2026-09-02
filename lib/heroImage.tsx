import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 1200x630 — Open Graph / Twitter-card standard, and ImageResponse's own
// default. One generated asset doubles as the social-share image too.
export const HERO_IMAGE_WIDTH = 1200;
export const HERO_IMAGE_HEIGHT = 630;

// Dark base for every site, regardless of how light or dark its own accent
// colour is — guarantees white title text stays legible. The accent colour
// still carries the per-site identity via the icon badge and label.
const BACKGROUND = "#0f172a";

interface HeroImageFonts {
  regular: ArrayBuffer;
  bold: ArrayBuffer;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

let fontsPromise: Promise<HeroImageFonts> | null = null;

// Lazy + cached, same pattern as getSupabaseAdmin(): avoids reading these
// files at module-import time (which would run during the Next.js build).
export function loadHeroImageFonts(): Promise<HeroImageFonts> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const [regular, bold] = await Promise.all([
        readFile(join(process.cwd(), "assets/fonts/Inter-Regular.woff")),
        readFile(join(process.cwd(), "assets/fonts/Inter-Bold.woff")),
      ]);
      return { regular: toArrayBuffer(regular), bold: toArrayBuffer(bold) };
    })();
  }
  return fontsPromise;
}

// Real titles range from ~30 to 113 characters (checked against live data).
// Longer titles get a smaller size so they still fit in the fixed canvas
// instead of overflowing or getting cut off mid-word.
function titleFontSize(title: string): number {
  const len = title.length;
  if (len <= 40) return 64;
  if (len <= 60) return 54;
  if (len <= 80) return 46;
  if (len <= 100) return 38;
  return 32;
}

// PascalCase icon name (as used in lib/imageTopics.ts) -> lucide-static's
// kebab-case filename, e.g. "BarChart3" -> "bar-chart-3".
function toKebabCase(name: string): string {
  return name
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

const iconDataUriCache = new Map<string, Promise<string>>();

// Icons render via <img src="data:image/svg+xml;..."> rather than as JSX
// elements: lucide-react's components carry a "use client" directive that
// can't be invoked from a server-side route handler (confirmed by a real
// 500 during testing), and Satori supports data-URI <img> natively anyway.
// currentColor doesn't resolve inside an <img>-embedded SVG (no CSS
// cascade reaches it), so the colour is baked into the file as a literal
// stroke value before encoding.
export function loadIconDataUri(
  iconName: string,
  color: string,
): Promise<string> {
  const cacheKey = `${iconName}:${color}`;
  const cached = iconDataUriCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const kebabName = toKebabCase(iconName);
    let svg: string;
    try {
      svg = await readFile(
        join(process.cwd(), "assets/icons", `${kebabName}.svg`),
        "utf8",
      );
    } catch {
      svg = await readFile(
        join(process.cwd(), "assets/icons/file-text.svg"),
        "utf8",
      );
    }
    const tinted = svg.replace(/currentColor/g, color);
    const base64 = Buffer.from(tinted, "utf8").toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  })();

  iconDataUriCache.set(cacheKey, promise);
  return promise;
}

export interface HeroImageInput {
  title: string;
  iconDataUri: string;
  accentColour: string;
  siteName: string;
}

export function buildHeroImageElement({
  title,
  iconDataUri,
  accentColour,
  siteName,
}: HeroImageInput) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: BACKGROUND,
        padding: "64px",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 88,
            height: 88,
            borderRadius: 24,
            backgroundColor: accentColour,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser */}
          <img src={iconDataUri} width={48} height={48} alt="" />
        </div>
        <div
          style={{
            display: "flex",
            color: accentColour,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {siteName}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          color: "#ffffff",
          fontSize: titleFontSize(title),
          fontWeight: 700,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
    </div>
  );
}
