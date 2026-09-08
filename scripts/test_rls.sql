-- =====================================================================
-- RLS BOUNDARY TEST
-- =====================================================================
-- Proves tenant isolation actually holds, by impersonating three callers and
-- counting what each can see.
--
-- CRITICAL: the probe switches to the `authenticated` role before counting.
-- The SQL Editor connects as the table owner, and RLS does not apply to the
-- owner unless FORCE ROW LEVEL SECURITY is set — without the role switch all
-- three scenarios return identical counts and the test passes while proving
-- nothing.
--
-- Structured as a function rather than a temp table because the Supabase SQL
-- Editor does not guarantee a single session across statements.
--
-- !! rls_probe is a privilege-escalation primitive: it sets request.jwt.claims
-- !! to anything the caller passes. Execute is revoked from every application
-- !! role at creation, and STEP 3 drops it. Do not leave it in a database that
-- !! serves real users, and never create it in production.
-- =====================================================================


-- --- STEP 1: create the probe -----------------------------------------
create or replace function public.rls_probe(p_claims jsonb)
returns table(object text, visible int)
language plpgsql
volatile
as $fn$
begin
  perform set_config('request.jwt.claims', p_claims::text, true);
  set local role authenticated;

  return query
              select 'customers'::text,         count(*)::int from customers
    union all select 'sites'::text,             count(*)::int from sites
    union all select 'requisitions'::text,      count(*)::int from requisitions
    union all select 'requisition_lines'::text, count(*)::int from requisition_lines
    union all select 'crafts'::text,            count(*)::int from crafts
    union all select 'workers'::text,           count(*)::int from workers;

  reset role;
end $fn$;

revoke execute on function public.rls_probe(jsonb) from public, anon, authenticated;


-- --- STEP 2: run the three scenarios ----------------------------------
select '1. acme customer' as scenario, * from public.rls_probe(
  '{"sub":"5ec7b203-cf6f-4d32-95bd-3ce49b8ff9ce",
    "app_metadata":{"user_type":"customer",
                    "customer_id":"a0000000-0000-4000-8000-000000000001",
                    "customer_role":"customer_admin"}}'::jsonb)
union all
select '2. other tenant', * from public.rls_probe(
  '{"sub":"00000000-0000-4000-8000-0000000000ff",
    "app_metadata":{"user_type":"customer",
                    "customer_id":"b0000000-0000-4000-8000-0000000000ff",
                    "customer_role":"customer_admin"}}'::jsonb)
union all
select '3. agency super admin', * from public.rls_probe(
  '{"sub":"72a4c929-1c15-40e7-b864-a92e7ed2d901",
    "app_metadata":{"user_type":"agency","agency_role":"super_admin"}}'::jsonb)
union all
-- A staff account with no customers assigned. Expect zero customers, sites,
-- requisitions and lines — and the FULL crafts and workers counts, because the
-- roster and the reference catalogue belong to US Trades rather than to any
-- one tenant. If this row shows customers, the assignment scoping is not on.
select '4. agency, unassigned', * from public.rls_probe(
  '{"sub":"00000000-0000-4000-8000-00000000beef",
    "app_metadata":{"user_type":"agency","agency_role":"recruiter"}}'::jsonb)
order by 1, 2;


-- --- STEP 3: remove the probe -----------------------------------------
drop function if exists public.rls_probe(jsonb);
