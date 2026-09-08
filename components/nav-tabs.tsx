"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Customer portal navigation, styled as the dashboard's role switch.
 *
 * Client-side because the active state needs the current path.
 */
const TABS = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/requests", label: "Requests", also: ["/requisitions"] },
  { href: "/workers", label: "Workers" },
  { href: "/sites", label: "Sites" },
  { href: "/jobs", label: "Job log" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <div className="nav-row">
      {TABS.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname.startsWith(t.href) ||
            (t.also ?? []).some((p) => pathname.startsWith(p));
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
