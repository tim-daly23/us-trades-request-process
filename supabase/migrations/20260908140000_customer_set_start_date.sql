-- =====================================================================
-- CUSTOMER-SET START DATES
-- =====================================================================
-- The customer decides when each person is wanted at the gate, and a crew
-- rarely starts together. placements stays agency-write-only, so this is a
-- definer function with the same two checks as the on-site controls: the
-- caller owns the tenant, and the placement was actually submitted to them.
-- =====================================================================

create or replace function customer_set_placement_start(
  p_placement_id uuid,
  p_start        date
)
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

  if v_p.stage in ('completed', 'ended_early', 'no_show', 'withdrawn', 'removed') then
    raise exception 'This placement has already finished';
  end if;

  -- Once someone is on site the meaningful date is the day they actually
  -- walked in, so editing the date then corrects that rather than a plan that
  -- has already happened.
  if v_p.stage = 'started' then
    update placements set actual_start_date = p_start
     where id = p_placement_id returning * into v_p;
  else
    update placements set scheduled_start_date = p_start
     where id = p_placement_id returning * into v_p;
  end if;

  return v_p;
end $fn$;

/**
 * Marking someone on site now honours the date already chosen for them.
 *
 * Without this, recording a Monday start on Wednesday would stamp Wednesday.
 * The scheduled date is what the customer set deliberately; today is only the
 * fallback when nobody set one.
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
         actual_start_date = coalesce(actual_start_date, scheduled_start_date, current_date)
   where id = p_placement_id
   returning * into v_p;

  return v_p;
end $fn$;

revoke execute on function customer_set_placement_start(uuid, date) from public, anon;
grant execute on function customer_set_placement_start(uuid, date) to authenticated;
