# Schema review notes

Record of what was changed from the first draft of the schema and why. The
corrections are folded into `20260903120000_initial_schema.sql` rather than
shipped as a follow-up patch, because nothing is deployed yet — migration #1
should not contain a known candidate-visibility leak.

Reviewed 2026-09-03. **Not yet executed against a live Postgres** — run
`supabase db reset` to confirm it applies cleanly before building on it.

---

## Blocking issues found and fixed

### 1. Enum ordering leaked internal-only candidates to customers

The original trigger decided customer visibility by comparing enum position:

```sql
if new.stage >= 'submitted_to_customer'::placement_stage then
  new.is_customer_visible = true;
```

`withdrawn`, `removed`, and `no_show` are all declared *after*
`submitted_to_customer`, so they compare greater — but they can happen at **any**
stage. A worker we identified, contacted, screened, and who then backed out
would go `contacted → withdrawn` and become visible to the customer, despite
never having been submitted to them.

This is the rule the entire customer/internal boundary rests on, so it should
not be an implicit consequence of the order somebody typed the enum values in.
Replaced with an explicit list, `placement_customer_visible_stages()`, and
visibility is now sticky via `old.is_customer_visible` rather than re-derived.

**If any data already exists**, hide the wrongly-exposed rows:

```sql
update placements p set is_customer_visible = false
 where p.is_customer_visible and p.submitted_at is null
   and not exists (select 1 from placement_events e
                    where e.placement_id = p.id
                      and e.to_stage = any (placement_customer_visible_stages()));
```

### 2. `line_effective_requirements` returned contradictory rows

It was a `UNION` of two *pre-aggregated* selects. `UNION` dedupes whole rows,
not `(line, credential)` — so if the requisition header marks TWIC required and
a line override marks it preferred, both rows survive and whatever computes
`credential_gaps` picks one arbitrarily. Now aggregates across the union, with
`bool_or` so required wins over preferred.

### 3. RLS made cross-user notifications impossible

`notifications_own` was `FOR ALL WITH CHECK (user_id = auth_user_id())`.
"Notify the assigned recruiter that a requisition was submitted" is an insert
for *somebody else* — permanently denied. Every cross-user event was dead.

`audit_log` was worse: RLS on, `SELECT` policy only, no `INSERT` policy at all,
so nothing could write audit rows except the table owner.

Both now split read from write, with writes going through `SECURITY DEFINER`
functions (`emit_notification`) so application roles can't forge rows either.

### 4. Requisition lines were editable after the header was locked

`req_update` carefully restricted customers to `draft / pending_approval /
submitted`, then `req_lines_all` was `FOR ALL` with only a tenant check. A
requester could change `quantity` or rewrite `bill_rate` on an **active**
requisition with crew already on site. Same gap on both requirements tables.
Lines and requirements now inherit the header's editability window.

Related: `requisition_lines.customer_id` is denormalized for RLS *and* was
client-writable, meaning a line could be re-parented into another tenant. It is
now pinned to the parent requisition by trigger, along with the same column on
`requisition_attachments` and `requisition_comments`.

---

## Other corrections

| Issue | Fix |
|---|---|
| `current_setting('request.jwt.claims', true)::jsonb` throws `invalid_text_representation` when the GUC is set-but-empty, aborting every policy on that request | `nullif(..., '')` guard, factored into `jwt_claims()` |
| `customer_candidate_view` bypasses RLS by design but had no `security_barrier`, letting the planner run a cheap user-supplied qual before the tenant predicate | added `security_barrier = true` |
| Customers could never see global rate rows — `rates_read` required `customer_id = auth_customer_id()`, so `customer_id is null` defaults were invisible and a tenant with no overrides saw no rates at all | policy now admits global rows |
| `unique (customer_id, craft_id, level_id, effective_from)` with NULL `customer_id`: SQL treats NULLs as distinct, so unlimited duplicate global rates were allowed | unique index on `coalesce(customer_id, <nil uuid>)` |
| `credentials.code` was globally unique, so one tenant's custom `SITE_BADGE` blocked every other tenant from creating one | uniqueness scoped to owner |
| `req_number` used one global sequence, so ACME's first 2027 req might be `ACME-2027-0873`; and `to_char(now(),'YYYY')` used server time, so 6pm CST on Dec 31 got next year | per-customer per-year counter table, year taken in `America/Chicago` |
| `requisition_comments` had `edited_at` but no UPDATE/DELETE policy — no comment could ever be edited | added author-scoped policies |
| `unique (customer_id, name)` on sites ignored the soft delete, so a deleted site's name could never be reused | partial unique index `where deleted_at is null` |
| `requisition_fill_summary` inner-joined lines, so a submitted requisition with no lines vanished from both dashboards | `LEFT JOIN`, shows 0% |
| `credential_expiration_alerts` multiplied rows per active placement — one expiring TWIC listed three times for a worker with three assignments | `DISTINCT ON (wc.id)` |
| `sites.default_credential_ids uuid[]` had no referential integrity; a deleted credential left a dangling id that silently dropped off the request form | validating trigger |
| RLS does not apply to the table owner without `FORCE` | `FORCE` block included in §16, **commented out** pending confirmation that the migration/seed role is `BYPASSRLS` |

## Added

- **`customer_decide_placement(placement_id, approve, reason)`** — the original
  schema commented that customer approve/decline "goes through a SECURITY
  DEFINER RPC" but the function did not exist. Implemented: verifies the caller
  owns the tenant *and* the placement was actually submitted to them, rejects
  decisions on placements not awaiting one, requires a reason on decline.
- **`emit_notification(...)`** — system-generated notifications for users other
  than the caller.
- **`placement_customer_visible_stages()`** — single source of truth for the
  visibility rule, used by both the trigger and the RPC.

---

## Open questions for ops

These change behaviour and need a human answer before the app is built on top.

1. **Does `onboarding` count as a filled slot?** `recalc_line_fill()` currently
   counts only `confirmed`, `started`, `completed`. So a line where every worker
   is mid-badging still shows **open** on the customer dashboard, which will
   generate "why haven't you filled this" calls. The alternative overstates fill
   and hides badging risk. Current behaviour is the conservative one.

2. **Should a declined candidate stay visible to the customer?** Right now yes —
   visibility is sticky, so the customer keeps seeing someone they declined.
   That is usually right (audit trail, "we already saw him"), but confirm.

3. **`worker_customer_clearances` is customer-readable.** A customer can list
   every worker ever cleared at their sites, including `badge_number` and
   `bar_reason`, for workers never submitted to them. Probably intended, but it
   is the one place worker data reaches customers outside the redacted view.

4. **Who owns `requisition_lines.bill_rate`?** Customers can currently set it
   while the req is in `draft`. If rates are strictly ours to set, that column
   should be agency-write-only.

5. **`show_bill_rates` is per-customer, but rate visibility is per-role too.**
   A `requester` at a customer probably shouldn't see bill rates even when the
   flag is on. Worth deciding before the UI is built around it.
