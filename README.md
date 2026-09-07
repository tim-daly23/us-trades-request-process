# US Trades Manpower Portal

Multi-tenant portal where industrial customers submit manpower requisitions to
US Trades, and US Trades staff source, screen, and place craft workers against
them. Syncs to TempWorks.

**Status:** schema deployed and verified against live Postgres; tenant isolation proven by `scripts/test_rls.sql`. Next.js app scaffolded with Supabase auth — login works, feature screens not built yet.

---

## Architecture in one paragraph

One Postgres database, shared schema, tenant separation by a `customer_id`
column on every tenant-scoped table plus Row Level Security. US Trades staff
("agency" users) see across all tenants via a JWT claim; customer users see only
their own rows. The single most important rule in the system: **a candidate is
invisible to the customer until we explicitly submit them** — that is
`placements.is_customer_visible`, and it is set by trigger, never by the client.

## Layout

```
supabase/
  migrations/
    20260903120000_initial_schema.sql   tables, RLS, views, triggers, RPCs
  seed.sql                              global catalog: crafts, levels, credentials
docs/
  schema-review.md                      why the non-obvious parts are the way they are
```

## Running it locally

Requires [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/)
and the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
supabase init
supabase start
supabase db reset
```

`db reset` drops the local database, replays every migration in order, then
applies `seed.sql`. Run it after any schema change — migrations are append-only
once they have been pushed, but locally you rebuild from scratch every time.

Studio (browse tables, run SQL) is at http://localhost:54323 once `start`
finishes.

## Deploying schema changes

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Never edit a migration that has already been pushed. Write a new one.

## Conventions

- Money is `numeric(12,4)`. Never float.
- All timestamps are `timestamptz`, stored UTC. Display conversion happens in
  the app, using the *site's* timezone, not the browser's.
- Soft delete (`deleted_at`) where history matters; hard delete elsewhere.
- Every table in `public` has RLS enabled — no exceptions, even agency-only
  tables. A CI check asserts this.
- Every view is either `security_invoker = true`, or carries its own tenant
  predicate **and** `security_barrier = true`. See the warning block above the
  views in the migration.

## Open decisions

Tracked in `docs/schema-review.md` under "Open questions" — these need an
answer from ops before the app is built on top.
