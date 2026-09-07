import type { CSSProperties } from "react";

export type Branding = {
  displayName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
};

/**
 * US Trades' own brand, used for agency staff and as the fallback.
 * Colours are taken from the logo crest: navy field, red banner.
 */
export const DEFAULT_BRANDING: Branding = {
  displayName: "US Trades",
  primaryColor: "#013E5C",
  accentColor: "#8E1007",
  logoUrl: "/us-trades-logo.png",
};

/**
 * Only #rgb / #rrggbb is accepted. These values come from a database column a
 * tenant admin can edit, and they are interpolated into a style attribute —
 * anything else could break out of the CSS context.
 */
function safeHex(value: string | null | undefined, fallback: string): string {
  return value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
    ? value.trim()
    : fallback;
}

/**
 * Relative luminance per WCAG. Used to decide whether text sitting on the brand
 * colour should be white or near-black, so a tenant picking a pale brand colour
 * does not end up with unreadable white-on-yellow.
 */
function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? "#14181f" : "#ffffff";
}

export function brandingFrom(row: {
  display_name?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  logo_url?: string | null;
} | null): Branding {
  if (!row) return DEFAULT_BRANDING;
  return {
    displayName: row.display_name ?? DEFAULT_BRANDING.displayName,
    primaryColor: safeHex(row.primary_color, DEFAULT_BRANDING.primaryColor),
    accentColor: safeHex(row.accent_color, DEFAULT_BRANDING.accentColor),
    logoUrl: row.logo_url ?? null,
  };
}

/** CSS custom properties to spread onto the portal shell. */
export function brandingStyle(b: Branding): CSSProperties {
  return {
    "--brand": b.primaryColor,
    "--brand-fg": readableOn(b.primaryColor),
    "--accent": b.accentColor,
    "--accent-fg": readableOn(b.accentColor),
  } as CSSProperties;
}
