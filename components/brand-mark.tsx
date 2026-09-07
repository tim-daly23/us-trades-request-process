/**
 * Brand lockup for the header and the login card.
 *
 * Renders the tenant's uploaded logo when there is one. Otherwise it draws a
 * typographic wordmark, so the corner never looks unfinished and never depends
 * on an asset that may not have loaded.
 *
 * To use the real US Trades artwork, drop the file at public/us-trades-logo.svg
 * and set DEFAULT_BRANDING.logoUrl in lib/branding.ts to "/us-trades-logo.svg".
 */
export function BrandMark({
  logoUrl,
  name,
  variant = "onBrand",
  size = "sm",
}: {
  logoUrl: string | null;
  name: string;
  /** onBrand sits on a coloured header; onSurface sits on a white card. */
  variant?: "onBrand" | "onSurface";
  /** sm for the header strip, lg for the login card. */
  size?: "sm" | "lg";
}) {
  if (logoUrl) {
    // The US Trades logo is a square crest rather than a horizontal wordmark,
    // so it needs real height to stay legible — a wordmark's 32px would render
    // the lettering inside the badge unreadable.
    const height = size === "lg" ? "h-20" : "h-11";
    return (
      /* Tenant logos are arbitrary external URLs not known at build time, so
         next/image's optimizer cannot be configured for them. */
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={`${height} w-auto object-contain`}
      />
    );
  }

  const onBrand = variant === "onBrand";

  return (
    <span className="flex items-center gap-2" aria-label={name}>
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-[5px] text-[13px] font-black leading-none tracking-tight ${
          onBrand ? "bg-accent text-accent-fg" : "bg-brand text-brand-fg"
        }`}
      >
        US
      </span>
      <span className="leading-none">
        <span
          className={`block text-[15px] font-bold tracking-tight ${
            onBrand ? "text-brand-fg" : "text-foreground"
          }`}
        >
          TRADES
        </span>
        <span
          className={`block text-[9px] font-medium uppercase tracking-[0.18em] ${
            onBrand ? "text-brand-fg/60" : "text-muted"
          }`}
        >
          Manpower
        </span>
      </span>
    </span>
  );
}
