import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { NavTabs } from "@/components/nav-tabs";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects anonymous requests; this is the second gate,
  // so a misconfigured matcher cannot expose a page.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users")
    .select("full_name, user_type, customer_role, agency_role")
    .eq("id", user.id)
    .maybeSingle();

  const isAgency = profile?.user_type === "agency";

  // RLS returns only the caller's own tenant, so no filter is needed here.
  const { data: customer } = isAgency
    ? { data: null }
    : await supabase
        .from("customers")
        .select("display_name")
        .maybeSingle();

  return (
    <>
      <div className="brand-stripe" />
      <div className="shell">
        <div className="masthead">
          <div className="brand">
            <Image
              className="logo-mark"
              src="/us-trades-logo.png"
              alt="US Trades LLC logo"
              width={52}
              height={52}
              priority
            />
            <div>
              <h1>US Trades</h1>
              <p>
                Manpower Portal
                {!isAgency && customer?.display_name
                  ? ` · ${customer.display_name}`
                  : isAgency
                    ? " · Agency console"
                    : ""}
              </p>
            </div>
          </div>

          <div>
            <div className="nav-label">
              {isAgency ? (
                <Link href="/agency" style={{ color: "var(--brand-red)" }}>
                  → Agency console
                </Link>
              ) : (
                (profile?.full_name ?? user.email)
              )}
            </div>
            <NavTabs />
          </div>
        </div>

        {children}
      </div>
    </>
  );
}
