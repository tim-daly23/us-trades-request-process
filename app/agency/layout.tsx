import Image from "next/image";
import { requireAgency } from "@/lib/auth";
import { AgencyNav } from "@/components/agency/agency-nav";
import { UtilityNav } from "@/components/utility-nav";

export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAgency();

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
              <p>Agency Console · {profile.full_name ?? profile.email}</p>
            </div>
          </div>

          <div>
            <UtilityNav />
            <AgencyNav />
          </div>
        </div>

        {children}
      </div>
    </>
  );
}
