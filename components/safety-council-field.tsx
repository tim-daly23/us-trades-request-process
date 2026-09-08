"use client";

import { useState } from "react";

/**
 * Safety council requirement, with the classes revealed only when it applies.
 *
 * Most sites need none, and an always-visible box invites either a blank or a
 * guess. Asking only after the box is ticked means anything typed there was
 * typed deliberately.
 *
 * The list is stored in sites.safety_council_name — the column predates this
 * and holds whatever identifies the requirement, which in practice is the
 * classes rather than a council's name.
 */
export function SafetyCouncilField({
  defaultChecked = false,
  defaultValue = "",
}: {
  defaultChecked?: boolean;
  defaultValue?: string;
}) {
  const [required, setRequired] = useState(defaultChecked);

  return (
    <div style={{ marginBottom: 13 }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12.5,
          marginBottom: required ? 10 : 0,
        }}
      >
        <input
          type="checkbox"
          name="safety_council_required"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <span>Safety council training required at this site</span>
      </label>

      {required && (
        <label className="field" style={{ marginBottom: 0, maxWidth: 520 }}>
          <span>Which classes are required?</span>
          <textarea
            name="safety_council_name"
            rows={2}
            defaultValue={defaultValue}
            placeholder="Basic Plus, Site Specific, Confined Space…"
          />
        </label>
      )}

      {/* Keep the stored value when the requirement is unticked, so unchecking
          and re-checking does not silently discard what was typed. */}
      {!required && defaultValue && (
        <input type="hidden" name="safety_council_name" value={defaultValue} />
      )}
    </div>
  );
}
