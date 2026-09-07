-- =====================================================================
-- RLS BOUNDARY TEST
-- =====================================================================
-- Proves the tenant isolation actually holds, by impersonating three callers
-- and counting what each can see.
--
-- CRITICAL: `set local role authenticated` is not optional. The SQL Editor
-- connects as the table owner, and RLS does not apply to the owner unless
-- FORCE ROW LEVEL SECURITY is set. Without the role switch every query below
-- would return everything and the test would pass while proving nothing.
--
-- Runs entirely inside a transaction and rolls back. Changes nothing.
-- =====================================================================

begin;

create temp table rls_results(scenario text, object text, visible int);
grant all on rls_results to authenticated;

-- --- 1. The Acme customer user ----------------------------------------
select set_config('request.jwt.claims', json_build_object(
  'sub', '5ec7b203-cf6f-4d32-95bd-3ce49b8ff9ce',
  'app_metadata', json_build_object(
    'user_type', 'customer',
    'customer_id', 'a0000000-0000-4000-8000-000000000001',
    'customer_role', 'customer_admin')
)::text, true);
set local role authenticated;

insert into rls_results
            select '1. acme customer', 'customers',         count(*) from customers
  union all select '1. acme customer', 'sites',             count(*) from sites
  union all select '1. acme customer', 'requisitions',      count(*) from requisitions
  union all select '1. acme customer', 'requisition_lines', count(*) from requisition_lines
  union all select '1. acme customer', 'crafts',            count(*) from crafts
  union all select '1. acme customer', 'workers',           count(*) from workers;

reset role;

-- --- 2. A different tenant (must see nothing of Acme's) ----------------
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-0000000000ff',
  'app_metadata', json_build_object(
    'user_type', 'customer',
    'customer_id', 'b0000000-0000-4000-8000-0000000000ff',
    'customer_role', 'customer_admin')
)::text, true);
set local role authenticated;

insert into rls_results
            select '2. other tenant', 'customers',         count(*) from customers
  union all select '2. other tenant', 'sites',             count(*) from sites
  union all select '2. other tenant', 'requisitions',      count(*) from requisitions
  union all select '2. other tenant', 'requisition_lines', count(*) from requisition_lines
  union all select '2. other tenant', 'crafts',            count(*) from crafts
  union all select '2. other tenant', 'workers',           count(*) from workers;

reset role;

-- --- 3. US Trades staff (sees across tenants) --------------------------
select set_config('request.jwt.claims', json_build_object(
  'sub', '72a4c929-1c15-40e7-b864-a92e7ed2d901',
  'app_metadata', json_build_object(
    'user_type', 'agency',
    'agency_role', 'super_admin')
)::text, true);
set local role authenticated;

insert into rls_results
            select '3. agency staff', 'customers',         count(*) from customers
  union all select '3. agency staff', 'sites',             count(*) from sites
  union all select '3. agency staff', 'requisitions',      count(*) from requisitions
  union all select '3. agency staff', 'requisition_lines', count(*) from requisition_lines
  union all select '3. agency staff', 'crafts',            count(*) from crafts
  union all select '3. agency staff', 'workers',           count(*) from workers;

reset role;

select * from rls_results order by scenario, object;

rollback;
