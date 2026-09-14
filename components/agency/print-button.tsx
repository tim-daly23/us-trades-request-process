"use client";

/**
 * Opens the browser's print dialog, which is also where "Save as PDF" lives.
 *
 * A button rather than printing on load: an automatic dialog steals focus
 * before the page has finished rendering, and there is no way to get back to
 * the report without dismissing it first.
 */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
