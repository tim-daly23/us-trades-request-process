-- =====================================================================
-- f_admin_customers()
--
-- The customer picker when scoping a safety contact.
--
-- Definer for the reason that keeps recurring: `customers` belongs to the
-- manpower portal and its policy reads a JWT claim only staff have. A US
-- Trades training admin is not necessarily an app_users row, so selecting from
-- it returns nothing — and a picker with no options looks like "this customer
-- does not exist" rather than "you cannot see it".
--
-- Returns id and display name only. Nothing about billing, markup, domains or
-- any of the other thirty columns on that table; this exists to fill a
-- dropdown.
--
-- `deleted_at is null` because scoping somebody to a deleted customer is not a
-- thing anyone means to do.
-- =====================================================================
create or replace function f_admin_customers()
returns table (
  customer_id   uuid,
  display_name  text,
  slug          text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.display_name, c.slug::text
  from customers c
  where c.deleted_at is null
    and is_training_admin()
  order by c.display_name;
$$;

revoke all on function f_admin_customers() from public, anon;
grant execute on function f_admin_customers() to authenticated;
