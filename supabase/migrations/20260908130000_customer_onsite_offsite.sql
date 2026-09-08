-- =====================================================================
-- CUSTOMER-SIDE ON SITE / OFF SITE
-- =====================================================================
-- The customer knows before anyone else when a worker actually walked through
-- the gate, and when they stopped. Letting them record it directly is both
-- more accurate and less work than relaying it.
--
-- placements is agency-write-only by policy, so this goes through definer
-- functions rather than loosening that. Each verifies the caller owns the
-- tenant AND that the placement was actually submitted to them — a customer
-- must not be able to touch someone they were never shown.
-- =====================================================================

/**
 * Mark a worker as on site.
 *
 * Only from the stages where it makes sense: approved, badging, or cleared.
 * Someone still awaiting review has not been agreed to yet, and someone
 * already started does not need starting again.
 */
create or replace function customer_mark_on_site(p_placement_id uuid)
returns placements
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_p placements;
begin
  select * into v_p from placements where id = p_placement_id;
  if not found then
    raise exception 'placement not found';
  end if;

  if not (
    is_agency()
    or (v_p.customer_id = auth_customer_id() and v_p.is_customer_visible)
  ) then
    raise exception 'not authorized for this placement';
  end if;

  if v_p.stage not in ('customer_approved', 'onboarding', 'confirmed') then
    raise exception 'This worker is not ready to be marked on site (currently %)', v_p.stage;
  end if;

  update placements
     set stage             = 'started',
         actual_start_date = coalesce(actual_start_date, current_date)
   where id = p_placement_id
   returning * into v_p;

  return v_p;
end $fn$;

/**
 * Mark a worker off site, with a reason.
 *
 * The reason is required and stored verbatim: why someone left is the single
 * most useful thing to know later, and a blank field would make the record
 * worthless. ROF and transfer are the two that recur; anything else is typed.
 */
create or replace function customer_mark_off_site(
  p_placement_id uuid,
  p_reason       text
)
returns placements
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_p placements;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;

  select * into v_p from placements where id = p_placement_id;
  if not found then
    raise exception 'placement not found';
  end if;

  if not (
    is_agency()
    or (v_p.customer_id = auth_customer_id() and v_p.is_customer_visible)
  ) then
    raise exception 'not authorized for this placement';
  end if;

  if v_p.stage <> 'started' then
    raise exception 'This worker is not on site (currently %)', v_p.stage;
  end if;

  update placements
     set stage           = 'ended_early',
         actual_end_date = current_date,
         end_reason      = trim(p_reason)
   where id = p_placement_id
   returning * into v_p;

  return v_p;
end $fn$;

revoke execute on function customer_mark_on_site(uuid) from public, anon;
revoke execute on function customer_mark_off_site(uuid, text) from public, anon;
grant execute on function customer_mark_on_site(uuid) to authenticated;
grant execute on function customer_mark_off_site(uuid, text) to authenticated;
