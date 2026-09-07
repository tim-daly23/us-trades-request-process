/**
 * US Trades lockup.
 *
 * The supplied logo is a crest on a solid white field, so on the navy chrome it
 * sits inside a white tile rather than being knocked out — a white-background
 * JPG placed directly on navy reads as a stray rectangle. Replace
 * DEFAULT_BRANDING.logoUrl with a transparent SVG and the tile can go.
 */
export function BrandMark({
  logoUrl,
  name,
  variant = "onBrand",
  size = "sm",
  tagline,
}: {
  logoUrl: string | null;
  name: string;
  /** onBrand sits on the navy chrome; onSurface sits on a light panel. */
  variant?: "onBrand" | "onSurface";
  size?: "sm" | "lg";
  /** Small caps line under the wordmark, as on the login brand panel. */
  tagline?: string;
}) {
  const onBrand = variant === "onBrand";
  const tile = size === "lg" ? "h-14 w-14" : "h-9 w-9";
  const word = size === "lg" ? "text-[17px]" : "text-[13px]";

  return (
    <span className="flex items-center gap-2.5" aria-label={name}>
      {logoUrl ? (
        <span
          className={`flex ${tile} shrink-0 items-center justify-center bg-white p-0.5`}
        >
          {/* Tenant and brand logos are plain files, not build-time known
              assets, so next/image's optimizer cannot be configured. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={name}
            className="h-full w-full object-contain"
          />
        </span>
      ) : (
        <svg width="24" height="24" viewBox="0 0 34 34" fill="none">
          <rect
            x="0.75"
            y="0.75"
            width="32.5"
            height="32.5"
            stroke="var(--accent)"
            strokeWidth="2"
          />
          <path
            d="M9 24V10.5M9 10.5H17.5C19.5 10.5 21 12 21 14C21 16 19.5 17.5 17.5 17.5H9"
            stroke={onBrand ? "#FFFFFF" : "var(--brand)"}
            strokeWidth="2.6"
          />
          <path
            d="M17 17.5L25 24"
            stroke={onBrand ? "#FFFFFF" : "var(--brand)"}
            strokeWidth="2.6"
          />
        </svg>
      )}

      <span className="leading-tight">
        <span
          className={`block ${word} font-semibold tracking-[0.12em] ${
            onBrand ? "text-white" : "text-foreground"
          }`}
        >
          US TRADES
        </span>
        {tagline && (
          <span
            className={`block text-[10.5px] uppercase tracking-[0.16em] ${
              onBrand ? "text-on-brand-faint" : "text-muted-3"
            }`}
          >
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
