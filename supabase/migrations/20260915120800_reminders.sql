-- =====================================================================
-- Reminders
--
-- Who needs chasing, and a record of every chase.
--
-- The record is not bookkeeping. A reminder is the portal contacting a worker
-- unprompted, and three things follow from that: it must never double-send,
-- somebody must be able to answer "did we tell him?" months later, and a bug
-- in the sender must not turn into forty people getting the same email six
-- times. A table the sender writes before it sends gives all three.
-- =====================================================================

do $$ begin
  create type reminder_kind as enum ('due_soon', 'overdue', 'lapsed');
exception when duplicate_object then null; end $$;

create table training_reminders (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references people (id) on delete cascade,
  course_id    uuid not null references courses (id) on delete cascade,
  kind         reminder_kind not null,

  channel      text not null default 'email' check (channel in ('email', 'sms')),
  to_address   text not null,
  lang         text not null check (lang in ('en', 'es')),

  -- Null until the provider accepts it. A row with sent_at null and an error
  -- is a failed attempt worth seeing, not a silent nothing.
  sent_at      timestamptz,
  provider_id  text,
  error        text,

  created_at   timestamptz not null default now()
);

create index training_reminders_person_idx
  on training_reminders (person_id, course_id, kind, created_at desc);

alter table training_reminders enable row level security;

-- Readable by an admin, and by the person it was about — somebody should be
-- able to see what the portal has been sending them. Written only by the
-- sender, which runs as the service role and bypasses RLS.
create policy training_reminders_read on training_reminders
  for select to authenticated
  using (person_id = auth.uid() or is_training_admin());

-- =====================================================================
-- f_reminder_candidates()
--
-- Who is due a nudge right now. Pure read, no side effects — the sender
-- decides what to do with the list, and writes what it did.
--
-- Rules, in the order they matter:
--
--   * Only people who are not cleared. Nobody who has done it gets chased.
--   * Only people who can actually be reached. No email, no reminder — and
--     they show up in workers_needing_training_contact instead, which is a
--     different problem with a different fix.
--   * One kind per person, most serious first: a lapsed clearance outranks an
--     overdue date, which outranks an approaching one. Sending somebody two
--     emails about the same course on the same morning is how a portal
--     teaches people to ignore it.
--   * Nothing sent inside the cooldown. Weekly is a reminder; daily is
--     harassment, and it is the thing most likely to get the sender blocked
--     as spam.
--
-- Callable only by the service role. There is no admin gate inside it because
-- `authenticated` cannot execute it at all.
-- =====================================================================
create or replace function f_reminder_candidates(
  p_due_soon_days integer default 7,
  p_cooldown_days integer default 7
)
returns table (
  person_id    uuid,
  course_id    uuid,
  full_name    text,
  email        text,
  lang         text,
  kind         reminder_kind,
  due_date     date,
  days_overdue integer,
  customer_display_name text,
  course_title_en text,
  course_title_es text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tc.person_id,
    tc.course_id,
    p.full_name,
    p.email,
    p.preferred_lang,
    k.kind,
    tc.due_date,
    case when tc.due_date is not null and tc.due_date < current_date
         then (current_date - tc.due_date)::integer
         else 0 end,
    cu.display_name,
    c.title_en,
    c.title_es
  from f_training_clearance_all() tc
  join people    p  on p.id  = tc.person_id
  join courses   c  on c.id  = tc.course_id
  join customers cu on cu.id = tc.customer_id
  cross join lateral (
    select case
      when tc.lapsed then 'lapsed'::reminder_kind
      when tc.due_date is not null and tc.due_date < current_date then 'overdue'::reminder_kind
      when tc.due_date is not null
       and tc.due_date <= current_date + make_interval(days => p_due_soon_days)
        then 'due_soon'::reminder_kind
      else null
    end as kind
  ) k
  where not tc.cleared
    and p.active
    and p.role = 'employee'
    and c.active
    and k.kind is not null
    and nullif(trim(p.email), '') is not null
    and not exists (
      select 1 from training_reminders r
      where r.person_id = tc.person_id
        and r.course_id = tc.course_id
        and r.kind      = k.kind
        and r.sent_at is not null
        and r.sent_at > now() - make_interval(days => p_cooldown_days)
    )
  order by k.kind desc, tc.due_date nulls last, p.full_name;
$$;

-- Not callable by anybody signed in through the app. The sender holds the
-- service role; a worker or an admin has no business enumerating who is behind.
revoke all on function f_reminder_candidates(integer, integer) from public, anon, authenticated;
grant execute on function f_reminder_candidates(integer, integer) to service_role;
