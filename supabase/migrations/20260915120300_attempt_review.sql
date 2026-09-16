-- =====================================================================
-- f_attempt_review()
--
-- The per-question review shown after a graded attempt: what the question was,
-- what they chose, what was correct.
--
-- This exists because of a bug that only showed up against a real project.
-- 20260915120000 revokes SELECT on `questions` from `authenticated` and
-- re-grants every column except `correct_index`, so the answer key cannot be
-- pulled out of the browser with the taker's own token. Correct — but the
-- results page was reading `correct_index` through that same token and
-- resolving it to text in Node, which now fails with:
--
--   42501: permission denied for table questions
--
-- So the review has to be resolved where the key is actually readable. This
-- function returns TEXT and never an index, checks the attempt belongs to the
-- caller, and is the only path by which an employee can see a correct answer.
--
-- Note what it does NOT do: take a course id. You can only review an attempt
-- you have already submitted, which is what keeps this from being a way to read
-- the answer key before sitting the check.
-- =====================================================================
create or replace function f_attempt_review(p_attempt_id uuid)
returns table (
  question_id       uuid,
  -- Not `position`: that is a reserved word in a RETURNS TABLE list, which is
  -- parsed more strictly than a CREATE TABLE column list. The questions table
  -- gets away with it; this would not.
  question_position integer,
  prompt            text,
  correct_text      text,
  chosen_text       text,
  was_correct       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.position,
    case when a.lang = 'es' then q.prompt_es else q.prompt_en end,
    (case when a.lang = 'es' then q.choices_es else q.choices_en end) ->> q.correct_index,
    (case when a.lang = 'es' then q.choices_es else q.choices_en end)
      ->> nullif(a.answers ->> q.id::text, '')::integer,
    coalesce(
      nullif(a.answers ->> q.id::text, '')::integer = q.correct_index,
      false
    )
  from attempts a
  join questions q
    on q.course_id = a.course_id
   and q.active
  where a.id = p_attempt_id
    -- The scoping. An attempt id belonging to someone else returns nothing.
    and (a.person_id = auth.uid() or is_training_admin())
  order by q.position;
$$;

revoke all on function f_attempt_review(uuid) from public, anon;
grant execute on function f_attempt_review(uuid) to authenticated;
