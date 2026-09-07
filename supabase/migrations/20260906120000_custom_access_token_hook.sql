-- =====================================================================
-- CUSTOM ACCESS TOKEN HOOK
-- =====================================================================
-- Every RLS policy in this database reads:
--     request.jwt.claims -> 'app_metadata' ->> 'user_type'   (and customer_id)
--
-- Supabase does NOT populate those by default. This hook runs whenever an
-- access token is minted and copies the authoritative values out of app_users
-- into the token's app_metadata claim.
--
-- Until this hook is BOTH installed here AND enabled in the dashboard
-- (Authentication -> Hooks -> Customize Access Token (JWT) Claims), every
-- policy evaluates against a null user_type and returns zero rows.
--
-- SECURITY: the client can never influence these values. They are read
-- server-side from app_users at token-mint time. A user editing their own
-- app_metadata through the client API cannot affect what this writes, because
-- the hook overwrites those keys on every token issuance.
-- =====================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
-- Pinned explicitly: this executes as supabase_auth_admin, whose search_path
-- is not guaranteed to include public.
set search_path = public
as $fn$
declare
  v_claims jsonb;
  v_meta   jsonb;
  v_user   record;
begin
  select user_type, customer_id, customer_role, agency_role, is_active
    into v_user
    from public.app_users
   where id = (event ->> 'user_id')::uuid;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_meta   := coalesce(v_claims -> 'app_metadata', '{}'::jsonb);

  if found and v_user.is_active then
    v_meta := v_meta || jsonb_build_object(
      'user_type',     v_user.user_type,
      'customer_id',   v_user.customer_id,
      'customer_role', v_user.customer_role,
      'agency_role',   v_user.agency_role
    );
  else
    -- No app_users row, or the account is deactivated: strip the claims
    -- entirely so the token authenticates but authorizes nothing. Every
    -- policy then sees a null user_type and returns no rows.
    v_meta := v_meta - 'user_type' - 'customer_id' - 'customer_role' - 'agency_role';
  end if;

  v_claims := jsonb_set(v_claims, '{app_metadata}', v_meta);
  return jsonb_set(event, '{claims}', v_claims);
end $fn$;

-- The hook executes as supabase_auth_admin, which is outside the normal
-- application roles and has no access to public by default.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on table public.app_users to supabase_auth_admin;

-- app_users has RLS enabled, so the grant alone is not enough — the auth admin
-- needs a policy of its own. Scoped to SELECT only.
-- Postgres has no CREATE POLICY IF NOT EXISTS, so drop first to stay rerunnable.
drop policy if exists app_users_auth_admin_read on public.app_users;
create policy app_users_auth_admin_read on public.app_users
  as permissive for select
  to supabase_auth_admin
  using (true);

-- No application role may call the hook directly.
revoke execute on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;
