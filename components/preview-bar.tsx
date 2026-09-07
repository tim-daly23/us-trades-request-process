"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setPreviewCustomer } from "@/app/(portal)/preview-actions";

/**
 * Staff-only strip above the customer portal.
 *
 * Makes it unmistakable that what follows is a customer's view rather than the
 * console, and lets staff switch between customers without signing in as them.
 */
export function PreviewBar({
  customers,
  activeId,
  activeName,
}: {
  customers: { id: string; display_name: string }[];
  activeId: string | null;
  activeName: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(id: string) {
    const fd = new FormData();
    fd.set("customer_id", id);
    start(async () => {
      await setPreviewCustomer(fd);
      router.refresh();
    });
  }

  return (
    <div
      style={{
        background: activeId ? "var(--ink)" : "var(--steel)",
        color: "#fff",
        padding: "8px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 12.5,
        }}
      >
        <strong
          style={{
            fontFamily: "var(--font-barlow)",
            fontSize: 13,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Staff preview
        </strong>

        <span style={{ opacity: 0.85 }}>
          {activeId
            ? `You are seeing ${activeName} exactly as they see it.`
            : "Choose a customer to see their portal as they do."}
        </span>

        <span style={{ flexGrow: 1 }} />

        <select
          value={activeId ?? ""}
          disabled={pending}
          onChange={(e) => choose(e.target.value)}
          style={{
            background: "#fff",
            color: "var(--ink)",
            border: "1.5px solid rgba(255,255,255,0.4)",
            padding: "4px 8px",
            fontSize: 12.5,
          }}
        >
          <option value="">— no customer selected —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>

        <Link
          href="/agency"
          style={{
            color: "#fff",
            borderBottom: "1px dotted rgba(255,255,255,0.6)",
            textDecoration: "none",
          }}
        >
          Back to console
        </Link>
      </div>
    </div>
  );
}
