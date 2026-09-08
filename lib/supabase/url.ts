/**
 * Normalize the configured Supabase URL to the project origin.
 *
 * Supabase's settings page shows the Data API endpoint —
 * https://<ref>.supabase.co/rest/v1/ — more prominently than the bare project
 * URL, and copying it is an easy mistake. The client then builds auth calls as
 * .../rest/v1/auth/v1/token and the server answers "Invalid path specified in
 * request URL", which names neither the cause nor the setting.
 *
 * Everything the SDK does is derived from the origin, so trimming a trailing
 * path is safe and turns a confusing failure into no failure at all.
 */
export function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin;
  } catch {
    // Not parseable as a URL — hand it back untouched and let the SDK complain
    // about the real problem rather than masking it here.
    return trimmed;
  }
}
