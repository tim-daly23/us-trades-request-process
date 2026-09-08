import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm, PasswordForm } from "@/components/account-forms";
import { formatDateTime } from "@/lib/format";

const ROLE_DESCRIPTION: Record<string, string> = {
  customer_admin:
    "Administrator — raise requests, approve candidates, manage your sites and your team, and see bill rates.",
  approver:
    "Approver — raise requests, approve candidates, and see bill rates.",
  requester: "Requester — raise requests and track them. Bill rates are hidden.",
  viewer: "Viewer — read only.",
  super_admin: "US Trades — full access to every customer.",
  ops_manager: "US Trades — operations.",
  recruiter: "US Trades — recruiting.",
  compliance: "US Trades — compliance.",
  finance: "US Trades — finance.",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users")
    .select(
      "email, full_name, phone, title, user_type, customer_role, agency_role, last_login_at, created_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  const { data: customer } =
    profile?.user_type === "customer"
      ? await supabase.from("customers").select("display_name").maybeSingle()
      : { data: null };

  const role = profile?.customer_role ?? profile?.agency_role ?? "";

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 24 }}>Your account</h2>
          <div className="sub">
            Your details and password. Changes take effect immediately.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Your details</h2>
            <div className="sub">
              How US Trades reaches you about your requests.
            </div>
          </div>
        </div>

        <ProfileForm
          fullName={profile?.full_name ?? ""}
          phone={profile?.phone ?? ""}
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Password</h2>
            <div className="sub">
              Change the password you use to sign in.
            </div>
          </div>
        </div>

        <PasswordForm email={profile?.email ?? user.email ?? ""} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Access</h2>
            <div className="sub">
              What this account can do. Only US Trades can change it.
            </div>
          </div>
        </div>

        <table className="data-table">
          <tbody>
            <Row label="Email" value={profile?.email ?? user.email ?? "—"} mono />
            {customer?.display_name && (
              <Row label="Company" value={customer.display_name} />
            )}
            <Row
              label="Role"
              value={ROLE_DESCRIPTION[role] ?? role.replace(/_/g, " ") ?? "—"}
            />
            <Row
              label="Last sign-in"
              value={formatDateTime(profile?.last_login_at)}
              mono
            />
          </tbody>
        </table>

        <div className="hint">
          Your email address and role are set by US Trades. Ask your rep if
          either needs changing — an email change would move your sign-in, so it
          is not something to do by accident.
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <tr>
      <td style={{ width: 150, color: "var(--steel)" }}>{label}</td>
      <td className={mono ? "mono" : undefined}>{value}</td>
    </tr>
  );
}
