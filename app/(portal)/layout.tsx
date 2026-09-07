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
  const name = profile?.full_name ?? user.email ?? "";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");

  return (
    <div
      style={brandingStyle(branding)}
      className="flex min-h-screen flex-col bg-background"
    >
      <header className="flex h-[54px] shrink-0 items-center justify-between gap-6 bg-brand px-[22px]">
        <div className="flex items-center gap-7">
          <BrandMark logoUrl={DEFAULT_BRANDING.logoUrl} name="US Trades" />
          <nav className="flex items-center gap-1">
            <NavLink href="/">Requests</NavLink>
            <NavLink href="/diagnostics">Diagnostics</NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* White plate rather than red-on-navy: the brand red and the brand
              navy are both dark, so a red button on the navy bar has almost no
              luminance separation from it. Inverting keeps the action obvious
              and still reads as brand. */}
          <Link
            href="/requisitions/new"
            className="flex h-[33px] items-center gap-2 bg-white px-3.5 text-[13px] font-semibold text-accent transition hover:bg-white/90"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 2.5V11.5M2.5 7H11.5" />
            </svg>
            New request
          </Link>

          <div className="flex items-center gap-2.5 border-l border-white/15 pl-4">
            <span className="flex h-7 w-7 items-center justify-center bg-[#47596F] text-[11.5px] font-medium text-white">
              {initials || "US"}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[12.5px] text-white">{name}</span>
              <span className="block text-[10.5px] text-white/55">
                {isAgency ? "US Trades" : branding.displayName}
              </span>
            </span>
            <form action="/auth/signout" method="post">
              <button
                className="ml-1 text-[11.5px] text-white/70 underline-offset-2 transition hover:text-white hover:underline"
                title="Sign out"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="flex h-[46px] shrink-0 items-center justify-between border-t border-line bg-surface px-7">
        <span className="num text-[11.5px] text-muted-3">
          {isAgency ? "console.ustrades.com" : "portal.ustrades.com"}
        </span>
        <span className="text-[11.5px] text-muted-3">
          © {new Date().getFullYear()} US Trades
        </span>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-[13.5px] text-white/75 transition hover:bg-white/12 hover:text-white"
    >
      {children}
    </Link>
  );
}
