-- =====================================================================
-- Give the customer roster enough identity to be readable
--
-- f_customer_roster() returned course_id and nothing to say which customer or
-- which course a row belonged to. With one customer and one course that reads
-- fine. `viewer_scopes` is many-to-many and `courses` is per customer, so the
-- moment a safety manager covers two sites — or M&D adds a second course — the
-- rows become indistinguishable, and a roster you cannot attribute is worse
-- than no roster.
--
-- Adding columns to a function's return type means dropping it, and the view
-- depends on it, so both are recreated. The scoping is unchanged: still
-- definer, still filtered by viewer_scopes against auth.uid(), still the
-- narrow column list.
--
-- What is deliberately still absent: email, phone, attempt_count, last_score,
-- answers. CLAUDE.md is explicit that a client_viewer sees name, crew,
-- language, start date, watch progress, best score, cleared status and date —
-- and nothing else. cleared_basis and the expiry are additions to that list,
-- because without them "cleared" cannot be read correctly.
-- =====================================================================

drop view if exists v_customer_roster;
drop function if exists f_customer_roster();

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
    -- The worker must be stationed at the customer's site, not merely assigned
    -- a course the customer happens to own.
    and p.customer_id = tc.customer_id
    and exists (
      select 1
      from viewer_scopes vs
      where vs.person_id = auth.uid()
        and vs.customer_id = p.customer_id
    )
  order by cu.display_name, p.crew nulls last, p.full_name;
$$;

grant execute on function f_customer_roster() to authenticated;

create or replace view v_customer_roster
with (security_barrier = true)
as
select * from f_customer_roster();

grant select on v_customer_roster to authenticated;
