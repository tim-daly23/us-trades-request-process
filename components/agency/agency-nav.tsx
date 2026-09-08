"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/agency", label: "Requests", exact: true },
  { href: "/agency/workers", label: "Workers" },
  { href: "/agency/customers", label: "Customers" },
  // Only a super admin can open this, so only a super admin is offered it.
  { href: "/agency/team", label: "Team", adminOnly: true },
  { href: "/", label: "Portal view" },
];

export function AgencyNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <div className="nav-row">
      {TABS.filter((t) => isAdmin || !t.adminOnly).map((t) => {
        const active = t.exact
          ? pathname === t.href
          : t.href !== "/" && pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`nav-btn${active ? " active" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
