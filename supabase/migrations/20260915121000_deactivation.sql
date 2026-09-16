-- =====================================================================
-- Make deactivation actually deactivate
--
-- `people.active` was being used in exactly one way: to filter which WORKERS
-- appear on a roster. Nothing anywhere checked whether the person DOING the
-- reading was still active.
--
-- So an admin or a customer safety contact switched off in the console kept
-- full access until somebody deleted their auth user. The button said "Turn
-- access off" and did not. Found by building the button and then trying it:
-- the viewer was set inactive and still read the whole roster.
--
-- This is the case that matters most for a customer contact — the safety
-- manager who leaves M&D is exactly who you need to be able to cut off, and
-- "we turned it off in the admin screen" is exactly what somebody would
-- reasonably believe had happened.
--
-- Two changes, and the first one does most of the work:
--
--   is_training_admin() now requires `active`. Every admin function is built
--   on it, so they are all covered at once rather than one at a time.
--
--   f_customer_roster() requires the viewer to be an active client_viewer,
--   not merely to have a viewer_scopes row.
-- =====================================================================

create or replace function is_training_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from people
    where id = auth.uid()
      and role = 'admin'
      and active
  );
$$;

-- f_customer_roster: the viewer themselves must still be active.
create or replace function f_customer_roster()
returns table (
  person_id              uuid,
  full_name              text,
  crew                   text,
  preferred_lang         text,
  start_date             date,
  customer_id            uuid,
  customer_display_name  text,
  course_id              uuid,
  course_title_en        text,
  course_title_es        text,
  watch_ratio            numeric,
  video_complete         boolean,
  best_score             integer,
  cleared                boolean,
  cleared_basis          text,
  in_person_completed_on date,
  last_worked_on         date,
  expires_on             date,
  lapsed                 boolean,
  passed_at              timestamptz,
  due_date               date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.full_name, p.crew, p.preferred_lang, p.start_date,
    cu.id, cu.display_name,
    c.id, c.title_en, c.title_es,
    tc.watch_ratio, tc.video_complete, tc.best_score,
    tc.cleared, tc.cleared_basis, tc.in_person_completed_on,
    tc.last_worked_on, tc.expires_on, tc.lapsed, tc.passed_at, tc.due_date
  from people p
  join f_training_clearance_all() tc on tc.person_id = p.id
  join courses   c  on c.id  = tc.course_id
  join customers cu on cu.id = tc.customer_id
  where p.active
    and p.role = 'employee'
    and p.customer_id = tc.customer_id
    -- The viewer must still be an active safety contact, not just somebody
    -- who once had a scope row.
    and exists (
      select 1
      from viewer_scopes vs
      join people v on v.id = vs.person_id
      where vs.person_id = auth.uid()
        and vs.customer_id = p.customer_id
        and v.active
        and v.role = 'client_viewer'
    )
  order by cu.display_name, p.crew nulls last, p.full_name;
$$;

grant execute on function f_customer_roster() to authenticated;
