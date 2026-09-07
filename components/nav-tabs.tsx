"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top-right navigation, styled as the dashboard's role switch: square buttons
 * with a heavy bottom rule that turns brand red on the active tab.
 *
 * Client-side because the active state needs the current path.
 */
const TABS = [
  { href: "/", label: "Requests" },
  { href: "/requisitions/new", label: "New request" },
  { href: "/diagnostics", label: "Session" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <div className="nav-row">
      {TABS.map((t) => {
        const active =
          t.href === "/"
            ? pathname === "/" || pathname.startsWith("/requisitions/")
              ? pathname !== "/requisitions/new"
              : false
            : pathname === t.href;
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
