-- =====================================================================
-- f_my_assigned_courses()
--
-- The course a worker owes, with the name of the customer who owns it.
--
-- Found by walking the flow in a browser: the course page said "no course
-- assigned yet" for someone who plainly had one. The app was reading
--
--   assignments -> courses!inner -> customers!inner
--
-- and `customers` belongs to the manpower portal, whose policy is
--
--   create policy customers_read on customers for select
--     using (can_access_customer(id));
--
-- `can_access_customer` reads `user_type` out of the JWT, which the access
-- token hook only sets for users with an `app_users` row. Workers have none —
-- correctly, they are not staff — so the claim is stripped, the inner join
-- matches nothing, and the whole query returns empty. No error, just a worker
-- told they have no training to do.
--
-- Loosening `customers_read` would be the wrong fix: that policy is doing its
-- job, and workers have no business reading the customer table generally. They
-- need one string, the display name of the customer whose course they were
-- assigned. So this function reaches it as definer and hands back exactly that.
-- =====================================================================
create or replace function f_my_assigned_courses()
returns table (
  assignment_id         uuid,
  due_date              date,
  course_id             uuid,
  slug                  text,
  title_en              text,
  title_es              text,
  description_en        text,
  description_es        text,
  video_uid_en          text,
  video_uid_es          text,
  duration_seconds      integer,
  pass_percent          integer,
  min_watch_ratio       numeric,
  version               integer,
  active                boolean,
  customer_id           uuid,
  customer_slug         text,
  customer_display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.due_date,
    c.id,
    c.slug,
    c.title_en,
    c.title_es,
    c.description_en,
    c.description_es,
    c.video_uid_en,
    c.video_uid_es,
    c.duration_seconds,
    c.pass_percent,
    c.min_watch_ratio,
    c.version,
    c.active,
    cu.id,
    cu.slug::text,
    cu.display_name
  from assignments a
  join courses   c  on c.id = a.course_id
  join customers cu on cu.id = c.customer_id
  -- The scoping, and the only reason this is safe as definer.
  where a.person_id = auth.uid()
  order by a.assigned_at asc;
$$;

revoke all on function f_my_assigned_courses() from public, anon;
grant execute on function f_my_assigned_courses() to authenticated;
