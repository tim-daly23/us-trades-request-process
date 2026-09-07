import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brandingFrom, brandingStyle, DEFAULT_BRANDING } from "@/lib/branding";
import { BrandMark } from "@/components/brand-mark";

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
        .select("display_name, primary_color, accent_color, logo_url")
        .maybeSingle();

  const branding = isAgency ? DEFAULT_BRANDING : brandingFrom(customer);
  const roleLabel = isAgency
    ? (profile?.agency_role ?? "").replace(/_/g, " ")
    : (profile?.customer_role ?? "").replace(/_/g, " ");

  return (
    <div
      style={brandingStyle(branding)}
      className="flex min-h-screen flex-col bg-background"
    >
      {/* The logo is a crest on a white field, so the header stays light and
          the brand colour carries as a top stripe and the nav underline. */}
      <div className="h-1 bg-brand" />

      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          {/* The US Trades crest is always first and always present: customers
              should never be in doubt about who is staffing their site. The
              tenant's own identity sits second, after the divider. */}
          <div className="flex items-center gap-3">
            <BrandMark
              logoUrl={DEFAULT_BRANDING.logoUrl}
              name={DEFAULT_BRANDING.displayName}
              variant="onSurface"
            />
            <span className="h-8 w-px bg-line" />
            {isAgency ? (
              <span className="text-sm font-semibold">Agency console</span>
            ) : (
              <span className="flex items-center gap-2.5">
                {branding.logoUrl && (
                  /* Tenant logos are arbitrary external URLs not known at
                     build time, so next/image cannot be configured for them. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={branding.logoUrl}
                    alt={branding.displayName}
                    className="h-7 w-auto object-contain"
                  />
                )}
                <span className="leading-tight">
                  <span className="block text-sm font-semibold">
                    {branding.displayName}
                  </span>
                  <span className="block text-[11px] text-muted">
                    Manpower portal
                  </span>
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-5">
            <span className="hidden text-right text-xs leading-tight text-muted sm:block">
              {profile?.full_name ?? user.email}
              {roleLabel && (
                <>
                  <br />
                  <span className="capitalize">{roleLabel}</span>
                </>
              )}
            </span>
            <form action="/auth/signout" method="post">
              <button className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand hover:text-brand">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          <NavLink href="/">Requisitions</NavLink>
          <NavLink href="/diagnostics">Diagnostics</NavLink>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-line py-4">
        <p className="mx-auto max-w-6xl px-6 text-xs text-muted">
          {isAgency
            ? "US Trades agency console"
            : `Staffed and operated by US Trades for ${branding.displayName}`}
        </p>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted transition hover:border-brand hover:text-foreground"
    >
      {children}
    </Link>
  );
}
