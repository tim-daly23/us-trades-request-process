"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/agency", label: "Queue", exact: true },
  { href: "/agency/workers", label: "Workers" },
  { href: "/agency/customers", label: "Customers" },
  { href: "/", label: "Portal view" },
];

export function AgencyNav() {
  const pathname = usePathname();

  return (
    <div className="nav-row">
      {TABS.map((t) => {
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
      <form action="/auth/signout" method="post">
        <button type="submit" className="nav-btn">
          Sign out
        </button>
      </form>
    </div>
  );
}
