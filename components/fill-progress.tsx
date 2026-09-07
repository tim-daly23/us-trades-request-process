/**
 * Seats filled, as a flat bar plus a monospace ratio.
 *
 * "Filled" means cleared and scheduled — nothing looser. Workers who are
 * accepted but still working through badging, DISA or safety council show as a
 * second, quieter segment so the bar never claims readiness the crew does not
 * yet have.
 */
export function FillProgress({
  requested,
  filled,
  onboarding,
  /** Wide places the ratio beneath; inline keeps it on one row, for tables. */
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
  const complete = requested > 0 && filled >= requested;

  const bar = (
    <span
      className={`flex h-1.5 ${layout === "inline" ? "w-[68px]" : "w-full"} shrink-0 bg-line-soft`}
      role="img"
      aria-label={`${filled} of ${requested} filled${
        onboarding > 0 ? `, ${onboarding} in onboarding` : ""
      }`}
    >
      <span
        className={complete ? "bg-brand" : "bg-ok"}
        style={{ width: `${filledPct}%` }}
      />
      {/* Muted blue rather than amber: onboarding is progress, not a warning. */}
      <span
        className="bg-[#9DAFC2]"
        style={{ width: `${onboardingPct}%` }}
      />
    </span>
  );

  const ratio = (
    <span
      className={`num text-[12px] ${filled === 0 && onboarding === 0 ? "text-muted-3" : ""}`}
    >
      {filled}/{requested}
      {onboarding > 0 && (
        <span className="ml-1.5 text-[11px] text-muted-2">+{onboarding}</span>
      )}
    </span>
  );

  if (layout === "stacked") {
    return (
      <span className="flex flex-col gap-1.5">
        {bar}
        <span className="flex items-baseline gap-2">
          {ratio}
          <span className="text-[11px] text-muted-2">
            seats filled
            {onboarding > 0 && ` · ${onboarding} in onboarding`}
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2.5">
      {bar}
      {ratio}
    </span>
  );
}
