-- =====================================================================
-- SCHEMA VERIFICATION
-- Run in the Supabase SQL Editor (or psql) against any environment.
-- Every row should read OK. Expected counts track the initial migration —
-- update them when you add tables/policies in a later migration.
-- =====================================================================

with expected(sort_key, check_name, expected) as (
  values
    (1, 'tables',      '31'),
    (2, 'rls_enabled', '31'),
    (3, 'policies',    '56'),
    (4, 'views',       '4'),
    (5, 'enum_types',  '19'),
    (6, 'functions',   '16'),
    (7, 'triggers',    '15'),
    (8, 'rls_missing', '(none)')
),
actual(check_name, actual) as (
  select 'tables',
         (select count(*) from pg_tables where schemaname = 'public')::text
  union all
  select 'rls_enabled',
         (select count(*) from pg_tables
           where schemaname = 'public' and rowsecurity)::text
  union all
  select 'policies',
         (select count(*) from pg_policies where schemaname = 'public')::text
  union all
  select 'views',
         (select count(*) from pg_views where schemaname = 'public')::text
  union all
  select 'enum_types',
         (select count(*) from pg_type t
            join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typtype = 'e')::text
  union all
  select 'functions',
         -- Exclude functions owned by an extension: citext and pg_trgm install
         -- into public here and contribute ~76 of their own.
         (select count(*) from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.prokind = 'f'
             and not exists (select 1 from pg_depend d
                              where d.objid = p.oid and d.deptype = 'e'))::text
  union all
  select 'triggers',
         -- Must be scoped to public: Supabase's own auth/storage schemas carry
         -- triggers that have nothing to do with this migration.
         (select count(*) from pg_trigger tg
            join pg_class c on c.oid = tg.tgrelid
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and not tg.tgisinternal)::text
  union all
  -- The rule the whole tenant model depends on: no table in public may have
  -- RLS switched off. This is the check that should fail a CI build.
  select 'rls_missing',
         -- Guard against a vacuous pass: with zero tables there are trivially
         -- zero tables missing RLS, which would otherwise report OK on an
         -- empty database and hide the fact that nothing was ever created.
         case when (select count(*) from pg_tables where schemaname = 'public') = 0
              then '(empty database)'
              else coalesce(
                     (select string_agg(tablename, ', ' order by tablename)
                        from pg_tables
                       where schemaname = 'public' and not rowsecurity),
                     '(none)')
         end
)
select e.check_name,
       e.expected,
       a.actual,
       case when a.actual = e.expected then 'OK' else '*** MISMATCH ***' end as status
  from expected e
  join actual a using (check_name)
 order by e.sort_key;
