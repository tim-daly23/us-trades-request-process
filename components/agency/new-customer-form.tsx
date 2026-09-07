"use client";

import { useRouter } from "next/navigation";
import { createCustomer } from "@/app/agency/actions";
import { ActionForm } from "./action-form";

export function NewCustomerForm() {
  const router = useRouter();

  return (
    <ActionForm
      action={createCustomer}
      submitLabel="Create customer"
      resetOnSuccess
      onSuccess={(id) => {
        if (typeof id === "string") router.push(`/agency/customers/${id}`);
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0 14px",
        }}
      >
        <label className="field">
          <span>
            Display name <span className="req-star">*</span>
          </span>
          <input name="display_name" required placeholder="Acme Industrial" />
        </label>

        <label className="field">
          <span>
            Legal name <span className="req-star">*</span>
          </span>
          <input
            name="legal_name"
            required
            placeholder="Acme Industrial Services, LLC"
          />
        </label>

        <label className="field">
          <span>
            Slug <span className="req-star">*</span>
          </span>
          <input
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9-]{1,30}"
            placeholder="acme"
            style={{ fontFamily: "var(--font-plex-mono)" }}
          />
        </label>

        <label className="field">
          <span>Billing email</span>
          <input name="billing_email" type="email" placeholder="ap@acme.com" />
        </label>

        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue="active">
            <option value="prospect">Prospect</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      <fieldset
        style={{
          border: "1px solid var(--line)",
          padding: "12px 14px",
          margin: "6px 0 14px",
        }}
      >
        <legend
          style={{ fontSize: 12, color: "var(--steel)", padding: "0 6px" }}
        >
          Portal behaviour
        </legend>
        <Check
          name="candidate_approval_required"
          defaultChecked
          label="Customer approves each candidate before onboarding"
        />
        <Check
          name="show_bill_rates"
          defaultChecked
          label="Show bill rates in their portal (admins and approvers only)"
        />
        <Check
          name="requires_internal_approval"
          label="Their requesters need internal approval before a request reaches us"
        />
        <Check
          name="show_worker_contact_info"
          label="Show worker names and contact details before approval"
        />
      </fieldset>
    </ActionForm>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 8,
        fontSize: 12.5,
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        style={{ width: 16, height: 16, marginTop: 1 }}
      />
      <span>{label}</span>
    </label>
  );
}
