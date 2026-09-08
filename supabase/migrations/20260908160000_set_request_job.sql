-- =====================================================================
-- ASSIGN A JOB NUMBER TO A REQUEST, AT ANY STATUS
-- =====================================================================
-- A customer's own edit window on a requisition closes once we acknowledge it
-- (req_update), which is right for the work itself — nobody should be able to
-- change the craft or the dates out from under a crew already on site.
--
-- The job number is not the work. It is a reference the customer attaches for
-- their own tracking, it is frequently decided after the request goes in, and
-- a site can carry many job numbers over the years so it can never be
-- inferred. So it gets its own function, callable whatever the status.
-- =====================================================================

create or replace function set_request_job(
  p_requisition_id uuid,
  p_job_id         uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_customer uuid;
  v_job_customer uuid;
begin
  select customer_id into v_customer
    from requisitions where id = p_requisition_id;
  if v_customer is null then
    raise exception 'request not found';
  end if;

  if not (is_agency() or v_customer = auth_customer_id()) then
    raise exception 'not authorized for this request';
  end if;

  -- A job may only be attached to a request in the same tenant. Without this
  -- check a customer could reference another company's job by id.
  if p_job_id is not null then
    select customer_id into v_job_customer
      from customer_jobs where id = p_job_id and deleted_at is null;
    if v_job_customer is null then
      raise exception 'job not found';
    end if;
    if v_job_customer <> v_customer then
      raise exception 'that job belongs to a different customer';
    end if;
  end if;

  update requisitions
     set customer_job_id = p_job_id
   where id = p_requisition_id;
end $fn$;

revoke execute on function set_request_job(uuid, uuid) from public, anon;
grant execute on function set_request_job(uuid, uuid) to authenticated;
