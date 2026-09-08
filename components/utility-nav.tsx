"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Account and sign out, set above the main tabs.
 *
 * They are not destinations in the same sense as Requests or Workers — nobody
 * goes to work in them — so giving them equal weight in the tab row made that
 * row longer and its choices less clear.
 */
export function UtilityNav({ label }: { label?: string }) {
  const pathname = usePathname();
  const onAccount = pathname === "/account";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        marginBottom: 6,
        fontSize: 11.5,
        color: "var(--steel)",
      }}
    >
      {label && <span>{label}</span>}
      {label && <span style={{ color: "var(--line-strong)" }}>·</span>}

      <Link
        href="/account"
        style={{
          color: onAccount ? "var(--brand-red)" : "var(--steel)",
          textDecoration: "none",
          borderBottom: `1px dotted ${onAccount ? "var(--brand-red)" : "var(--steel-dim)"}`,
        }}
      >
        Account
      </Link>

      <span style={{ color: "var(--line-strong)" }}>·</span>

      <form action="/auth/signout" method="post" style={{ display: "inline" }}>
        <button
          type="submit"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: 11.5,
            color: "var(--steel)",
            borderBottom: "1px dotted var(--steel-dim)",
          }}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
