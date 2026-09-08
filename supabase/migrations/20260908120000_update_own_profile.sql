-- =====================================================================
-- SELF-SERVICE PROFILE UPDATES
-- =====================================================================
-- app_users is writable by agency staff and by a customer_admin within their
-- own tenant. Everyone else — approvers, requesters, viewers — cannot edit
-- their own row, so they cannot correct their own name or phone number.
--
-- The obvious fix is a policy like `using (id = auth_user_id())`, and it is
-- wrong: RLS filters rows, not columns. Such a policy would also let any user
-- set their own customer_role to customer_admin, or move themselves to another
-- tenant. There is no WITH CHECK that prevents it, because the row would still
-- belong to them afterwards.
--
-- So the write goes through a definer function that touches exactly two
-- columns and always for the caller's own id.
-- =====================================================================

create or replace function update_own_profile(
  p_full_name text,
  p_phone     text
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth_user_id();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'A name is required';
  end if;

  update app_users
     set full_name = trim(p_full_name),
         phone     = nullif(trim(p_phone), '')
   where id = v_uid;
end $fn$;

-- Callable by any signed-in user; it can only ever write their own row.
revoke execute on function update_own_profile(text, text) from public, anon;
grant execute on function update_own_profile(text, text) to authenticated;
