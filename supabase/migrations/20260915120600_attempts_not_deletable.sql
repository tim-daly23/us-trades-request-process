-- =====================================================================
-- Stop a person delete from erasing the compliance record
--
-- Non-negotiable rule 6 says `attempts` is append-only: never updated, never
-- deleted, retakes are new rows. There are no UPDATE or DELETE policies on the
-- table, so no client can touch a row directly.
--
-- But `attempts.person_id` was `on delete cascade`. Deleting one `people` row
-- took the whole attempt history with it — the append-only guarantee had a
-- side door, and it was the door somebody would most plausibly walk through
-- while tidying up. `prior_completions` had the same problem: that is the
-- evidence behind an in-person clearance, with its provenance and the admin
-- who recorded it.
--
-- Where the line goes, and why it is not simply "restrict everything":
--
--   EVIDENCE restricts.  attempts, prior_completions. Once somebody has sat
--                        the check or had a paper record entered, that fact is
--                        permanent and the person cannot be deleted at all.
--                        Departures are `people.active = false`, which is what
--                        the column is for and what v_customer_roster filters
--                        on already.
--
--   STATE cascades.      assignments, watch_progress, viewer_scopes. These say
--                        what someone owes and how far through they are, not
--                        what they achieved. Leaving these cascadeable means a
--                        person enrolled by mistake — a typo, a duplicate, a
--                        worker queued against the wrong customer — can still
--                        be removed cleanly, which matters because the
--                        enrollment drain creates people automatically.
--
-- `training_audit_log.actor_id` was already NO ACTION and stays that way: the
-- audit trail is meant to outlive the actor.
-- =====================================================================

alter table attempts
  drop constraint if exists attempts_person_id_fkey;

alter table attempts
  add constraint attempts_person_id_fkey
  foreign key (person_id) references people (id)
  on delete restrict;

alter table prior_completions
  drop constraint if exists prior_completions_person_id_fkey;

alter table prior_completions
  add constraint prior_completions_person_id_fkey
  foreign key (person_id) references people (id)
  on delete restrict;

-- The admin who recorded a backfill is part of its provenance. Already NO
-- ACTION by omission; stated explicitly so it survives a future rewrite.
alter table prior_completions
  drop constraint if exists prior_completions_recorded_by_fkey;

alter table prior_completions
  add constraint prior_completions_recorded_by_fkey
  foreign key (recorded_by) references people (id)
  on delete restrict;

comment on constraint attempts_person_id_fkey on attempts is
  'RESTRICT, not CASCADE: deleting a person must not erase their attempt history. Deactivate with people.active instead.';

comment on constraint prior_completions_person_id_fkey on prior_completions is
  'RESTRICT, not CASCADE: an in-person completion is clearance evidence. Deactivate with people.active instead.';
