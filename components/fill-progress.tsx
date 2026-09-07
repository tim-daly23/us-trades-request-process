/**
 * Fill progress for a requisition or a single line.
 *
 * "Filled" means cleared and scheduled — nothing looser. Workers who are
 * accepted but still working through badging, DISA or safety council are shown
 * separately rather than folded into the fill number, so the bar never claims
 * readiness the crew does not yet have.
 */
export function FillProgress({
  requested,
  filled,
  onboarding,
  showLabel = true,
}: {
  requested: number;
  filled: number;
  onboarding: number;
  showLabel?: boolean;
}) {
  const total = Math.max(requested, 1);
  const filledPct = Math.min(100, (filled / total) * 100);
  const onboardingPct = Math.min(100 - filledPct, (onboarding / total) * 100);

  return (
    <div className="space-y-1">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="img"
        aria-label={`${filled} of ${requested} filled${
          onboarding > 0 ? `, ${onboarding} in onboarding` : ""
        }`}
      >
        <div
          className="bg-green-600 dark:bg-green-500"
          style={{ width: `${filledPct}%` }}
        />
        {/* Striped, not solid: visually distinct from filled even in greyscale. */}
        <div
          className="bg-amber-400 dark:bg-amber-500"
          style={{
            width: `${onboardingPct}%`,
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 6px)",
          }}
        />
      </div>

      {showLabel && (
        <p className="text-xs text-neutral-500">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {filled} of {requested}
          </span>{" "}
          filled
          {onboarding > 0 && (
            <>
              {" · "}
              <span className="font-medium text-amber-700 dark:text-amber-500">
                {onboarding} in onboarding
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
