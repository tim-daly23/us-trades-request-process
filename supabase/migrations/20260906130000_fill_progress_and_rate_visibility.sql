-- =====================================================================
-- FILL PROGRESS DETAIL + ROLE-SCOPED RATE VISIBILITY
-- =====================================================================
-- Two product decisions made concrete:
--
--  1. A slot is "filled" only when the worker is cleared and scheduled, but
--     the customer should still see how many are working through badging.
--     So filled_count keeps its strict meaning and onboarding_count is added
--     alongside it, rather than loosening what "filled" means.
--
--  2. Bill rates are visible to customer_admin and approver, not to every
--     user at the customer. show_bill_rates remains the company-level switch;
--     role is now an additional gate on top of it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Onboarding count alongside the strict fill count
-- ---------------------------------------------------------------------

alter table requisition_lines
  add column if not exists onboarding_count int not null default 0;

comment on column requisition_lines.filled_count is
  'Workers cleared and scheduled (confirmed/started/completed). Strict.';
comment on column requisition_lines.onboarding_count is
  'Workers accepted but not yet cleared (customer_approved/onboarding). '
  'Shown next to filled_count so progress is visible without overstating readiness.';

create or replace function recalc_line_fill() returns trigger
language plpgsql as $fn$
declare
  -- NOT coalesce(new.…, old.…): in PL/pgSQL, OLD is unassigned during INSERT
  -- and NEW is unassigned during DELETE, so referencing the wrong one is an
  -- error rather than a null. Branch on TG_OP instead.
  v_line uuid := case tg_op when 'DELETE' then old.requisition_line_id
                            else new.requisition_line_id end;
  v_filled     int;
  v_onboarding int;
  v_qty        int;
begin
  if v_line is null then
    return null;
  end if;

  select
    count(*) filter (where stage in ('confirmed','started','completed')),
    count(*) filter (where stage in ('customer_approved','onboarding'))
    into v_filled, v_onboarding
    from placements
   where requisition_line_id = v_line;

  select quantity into v_qty from requisition_lines where id = v_line;

  update requisition_lines
     set filled_count     = v_filled,
         onboarding_count = v_onboarding,
         status = case
                    when status in ('cancelled','closed') then status
                    when v_filled >= v_qty then 'filled'
                    when v_filled > 0      then 'partially_filled'
                    else 'open'
                  end
   where id = v_line;

  return null;
end $fn$;

-- Surface it on the dashboard rollup too.
create or replace view requisition_fill_summary
with (security_invoker = true) as
select
  r.id as requisition_id,
  r.customer_id,
  coalesce(sum(l.quantity), 0)                       as total_requested,
  coalesce(sum(l.filled_count), 0)                   as total_filled,
  coalesce(sum(l.onboarding_count), 0)               as total_onboarding,
  coalesce(sum(l.quantity) - sum(l.filled_count), 0) as total_open,
  count(l.id) filter (where l.status = 'open')       as open_lines,
  round(100.0 * coalesce(sum(l.filled_count), 0)
        / nullif(sum(l.quantity), 0), 1)             as pct_filled
from requisitions r
left join requisition_lines l
       on l.requisition_id = r.id and l.status <> 'cancelled'
where r.deleted_at is null
group by r.id, r.customer_id;

-- ---------------------------------------------------------------------
-- 2. Rate visibility: company switch AND role
-- ---------------------------------------------------------------------

create or replace function can_see_rates() returns boolean
language sql stable
set search_path = public
as $fn$
  select
    is_agency()
    or exists (
      select 1 from customers c
       where c.id = auth_customer_id()
         and c.show_bill_rates
         and auth_customer_role() in ('customer_admin','approver')
    );
$fn$;

drop policy if exists rates_read on craft_level_rates;
create policy rates_read on craft_level_rates for select
  using (
    (craft_level_rates.customer_id is null
     or craft_level_rates.customer_id = auth_customer_id()
     or is_agency())
    and can_see_rates()
  );

-- RLS is row-level, so it cannot mask a single column. requisition_lines.bill_rate
-- is therefore exposed through a view that nulls it for callers who may not see
-- rates. The app reads this view instead of the table for any customer-facing
-- screen; the underlying table stays available to agency tooling.
create or replace view requisition_lines_visible
with (security_invoker = true) as
select
  l.id,
  l.requisition_id,
  l.customer_id,
  l.line_number,
  l.craft_id,
  l.level_id,
  l.quantity,
  l.filled_count,
  l.onboarding_count,
  l.status,
  l.start_date,
  l.end_date,
  l.hours_per_day,
  l.days_per_week,
  l.per_diem_rate,
  l.notes,
  case when can_see_rates() then l.bill_rate end       as bill_rate,
  -- target_pay_rate is what we intend to pay the worker. That is never a
  -- customer's business, at any role.
  case when is_agency() then l.target_pay_rate end     as target_pay_rate,
  c.name  as craft_name,
  c.code  as craft_code,
  lv.name as level_name,
  lv.code as level_code,
  lv.rank as level_rank
from requisition_lines l
join crafts c  on c.id = l.craft_id
join levels lv on lv.id = l.level_id;
