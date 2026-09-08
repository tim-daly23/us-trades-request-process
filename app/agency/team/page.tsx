import { requireAgencyAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRole } from "@/lib/supabase/admin";
import { NewStaffForm } from "@/components/agency/new-staff-form";
import { StaffRow, type StaffMember } from "@/components/agency/staff-access";

const COLUMNS = 5;

export default async function TeamPage() {
  const me = await requireAgencyAdmin();
  const supabase = await createClient();

  const [{ data: staff }, { data: customers }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("app_users")
        .select("id, email, full_name, agency_role, is_active")
        .eq("user_type", "agency")
        .order("full_name", { nullsFirst: false })
        .returns<StaffMember[]>(),
      supabase
        .from("customers")
        .select("id, display_name")
        .order("display_name"),
      supabase
        .from("agency_customer_assignments")
        .select("app_user_id, customer_id"),
    ]);

  const rows = staff ?? [];
  const customerList = customers ?? [];

  const byUser = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const key = a.app_user_id as string;
    byUser.set(key, [...(byUser.get(key) ?? []), a.customer_id as string]);
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>US Trades team</h2>
            <div className="sub">
              {rows.length} {rows.length === 1 ? "account" : "accounts"}. Each
              person sees the customers ticked for them, and nothing else.
            </div>
          </div>
        </div>

        <table className="data-table">
          <colgroup>
            <col />
            <col style={{ width: 150 }} />
            <col />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Customers</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <StaffRow
                key={u.id}
                user={u}
                isSelf={u.id === me.id}
                customers={customerList}
                assigned={byUser.get(u.id) ?? []}
                columnCount={COLUMNS}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Add a team member</h2>
          </div>
        </div>
        <NewStaffForm disabled={!hasServiceRole()} />
      </div>
    </>
  );
}
