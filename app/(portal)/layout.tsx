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
      <header className="bg-brand text-brand-fg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <BrandMark logoUrl={branding.logoUrl} name={branding.displayName} />
            {/* Customer tenants get their own name beside the US Trades mark,
                so it is always clear whose portal this is and who runs it. */}
            {!isAgency && (
              <>
                <span className="h-7 w-px bg-white/20" />
                <span className="text-sm font-medium opacity-90">
                  {branding.displayName}
                </span>
              </>
            )}
            {isAgency && (
              <>
                <span className="h-7 w-px bg-white/20" />
                <span className="text-sm font-medium opacity-90">
                  Agency console
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-5">
            <span className="hidden text-right text-xs leading-tight opacity-80 sm:block">
              {profile?.full_name ?? user.email}
              {roleLabel && (
                <>
                  <br />
                  <span className="capitalize opacity-70">{roleLabel}</span>
                </>
              )}
            </span>
            <form action="/auth/signout" method="post">
              <button className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-medium transition hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="border-t border-white/15">
          <div className="mx-auto flex max-w-6xl gap-1 px-6">
            <NavLink href="/">Requisitions</NavLink>
            <NavLink href="/diagnostics">Diagnostics</NavLink>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-line py-4">
        <p className="mx-auto max-w-6xl px-6 text-xs text-muted">
          US Trades manpower portal
        </p>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="border-b-2 border-transparent px-3 py-2.5 text-sm font-medium opacity-80 transition hover:border-accent hover:opacity-100"
    >
      {children}
    </Link>
  );
}
