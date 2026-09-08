import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { NavTabs } from "@/components/nav-tabs";
import { UtilityNav } from "@/components/utility-nav";
import { PreviewBar } from "@/components/preview-bar";
import { getPortalScope, listCustomersForPreview } from "@/lib/preview";

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

  const scope = await getPortalScope();
  const customers = isAgency ? await listCustomersForPreview() : [];

  return (
    <>
      {isAgency && (
        <PreviewBar
          customers={customers}
          activeId={scope.customerId}
          activeName={scope.displayName}
        />
      )}
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
                {scope.displayName ? ` · ${scope.displayName}` : ""}
              </p>
            </div>
          </div>

          <div>
            {isAgency ? (
              <div className="nav-label">
                <Link href="/agency" style={{ color: "var(--brand-red)" }}>
                  → Agency console
                </Link>
              </div>
            ) : null}
            <UtilityNav label={profile?.full_name ?? user.email ?? undefined} />
            <NavTabs />
          </div>
        </div>

        {children}
      </div>
    </>
  );
}
