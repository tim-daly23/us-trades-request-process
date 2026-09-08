/**
 * The staff roles, and what each one means in practice.
 *
 * Only super_admin is load-bearing in the database: is_agency_admin() checks
 * for exactly that value, and everything else is scoped by the customers
 * assigned to the person. The rest are descriptive — they say what someone
 * does, not what they can reach.
 */
export const AGENCY_ROLE_OPTIONS = [
  {
    value: "super_admin",
    label: "Super admin — every customer, manages the team",
    short: "Super admin",
  },
  { value: "ops_manager", label: "Ops manager", short: "Ops manager" },
  { value: "recruiter", label: "Recruiter", short: "Recruiter" },
  { value: "compliance", label: "Compliance", short: "Compliance" },
  { value: "finance", label: "Finance", short: "Finance" },
  { value: "viewer", label: "Viewer", short: "Viewer" },
] as const;

export function agencyRoleLabel(role: string | null): string {
  return (
    AGENCY_ROLE_OPTIONS.find((r) => r.value === role)?.short ??
    (role ?? "—").replace(/_/g, " ")
  );
}
