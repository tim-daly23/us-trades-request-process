/**
 * Quantity filled: a flat bar and a monospace ratio, matching the dashboard's
 * table density.
 *
 * "Filled" means cleared and scheduled — nothing looser. Workers accepted but
 * still working through badging, DISA or safety council show as a separate
 * amber segment, so the bar never claims readiness the crew does not yet have.
 */
export function FillProgress({
  requested,
  filled,
  onboarding,
  layout = "inline",
}: {
  requested: number;
  filled: number;
  onboarding: number;
  layout?: "inline" | "stacked";
}) {
  const total = Math.max(requested, 1);
  const filledPct = Math.min(100, (filled / total) * 100);
  const onboardingPct = Math.min(100 - filledPct, (onboarding / total) * 100);

  const bar = (
    <span
      className="fill-track"
      style={layout === "stacked" ? { width: "100%" } : undefined}
      role="img"
      aria-label={`${filled} of ${requested} filled${
        onboarding > 0 ? `, ${onboarding} in onboarding` : ""
      }`}
    >
      <span className="fill-done" style={{ width: `${filledPct}%` }} />
      <span className="fill-onboarding" style={{ width: `${onboardingPct}%` }} />
    </span>
  );

  const ratio = (
    <span className="mono" style={{ fontSize: 12.5 }}>
      {filled}/{requested}
      {onboarding > 0 && (
        <span style={{ color: "var(--pending)", marginLeft: 6 }}>
          +{onboarding}
        </span>
      )}
    </span>
  );

  if (layout === "stacked") {
    return (
      <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {bar}
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          {ratio}
          <span style={{ fontSize: 12, color: "var(--steel)" }}>
            filled
            {onboarding > 0 && ` · ${onboarding} in onboarding`}
          </span>
        </span>
      </span>
    );
  }

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
      {bar}
      {ratio}
    </span>
  );
}
