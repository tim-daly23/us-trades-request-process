-- =====================================================================
-- DEV FIXTURE — one tenant, two users, one site, one requisition
-- =====================================================================
-- NOT part of the migration chain and NOT for production. This exists so the
-- RLS boundary can be exercised against real rows.
--
--   5ec7b203-cf6f-4d32-95bd-3ce49b8ff9ce  -> CUSTOMER user (Acme)
--   72a4c929-1c15-40e7-b864-a92e7ed2d901  -> AGENCY user (US Trades staff)
--
-- Both must already exist in auth.users (Authentication -> Users -> Add user).
-- Emails are read from auth.users so app_users can never drift out of sync
-- with the identity provider.
--
-- Safe to re-run: every insert is idempotent.
-- =====================================================================

-- --- tenant ------------------------------------------------------------
insert into customers (id, slug, legal_name, display_name, status,
                       billing_email, show_bill_rates, show_worker_contact_info,
                       candidate_approval_required)
values ('a0000000-0000-4000-8000-000000000001',
        'acme', 'Acme Industrial Services, LLC', 'Acme Industrial', 'active',
        'ap@acmeindustrial.example', true, false, true)
on conflict (id) do nothing;

-- --- users -------------------------------------------------------------
-- Agency: US Trades staff. customer_id must be null (chk_user_shape).
insert into app_users (id, email, full_name, user_type, agency_role, title, is_active)
select u.id, u.email, 'US Trades Staff', 'agency', 'super_admin', 'Operations', true
  from auth.users u
 where u.id = '72a4c929-1c15-40e7-b864-a92e7ed2d901'
on conflict (id) do nothing;

-- Customer: belongs to Acme, can administer their own org.
insert into app_users (id, email, full_name, user_type, customer_id,
                       customer_role, title, is_active)
select u.id, u.email, 'Acme Buyer', 'customer',
       'a0000000-0000-4000-8000-000000000001', 'customer_admin',
       'Maintenance Planner', true
  from auth.users u
 where u.id = '5ec7b203-cf6f-4d32-95bd-3ce49b8ff9ce'
on conflict (id) do nothing;

-- --- site --------------------------------------------------------------
insert into sites (id, customer_id, name, site_code,
                   address_line1, city, state, postal_code,
                   default_shift, default_hours_per_day, default_days_per_week,
                   default_per_diem_rate, reporting_location,
                   badging_lead_time_days, safety_council_required,
                   safety_council_name, created_by)
values ('50000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000001',
        'Baytown Olefins Plant', 'BAY-01',
        '5000 Bayway Dr', 'Baytown', 'TX', '77520',
        'day', 10, 6, 110.00, 'Gate 4, North Lot',
        3, true, 'Houston Area Safety Council',
        '72a4c929-1c15-40e7-b864-a92e7ed2d901')
on conflict (id) do nothing;

-- --- requisition -------------------------------------------------------
-- req_number is left null on purpose: the trg_req_number trigger generates
-- ACME-2026-0001 from the customer slug and the per-year counter.
insert into requisitions (id, customer_id, site_id, title, project_name,
                          status, urgency, start_date, duration_weeks,
                          shift, hours_per_day, days_per_week,
                          per_diem_rate, scope_of_work, created_by, submitted_by,
                          submitted_at)
values ('60000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000001',
        'Fall Turnaround — Unit 7', 'TA-2026-U7',
        'submitted', 'urgent', current_date + 21, 6,
        'day', 10, 6, 110.00,
        'Piping tie-ins and exchanger bundle pulls during the Unit 7 turnaround.',
        '5ec7b203-cf6f-4d32-95bd-3ce49b8ff9ce',
        '5ec7b203-cf6f-4d32-95bd-3ce49b8ff9ce',
        now())
on conflict (id) do nothing;

-- --- lines -------------------------------------------------------------
-- customer_id is pinned by trigger from the parent, so the value supplied
-- here is overwritten. Included only to satisfy NOT NULL.
insert into requisition_lines (id, requisition_id, customer_id, line_number,
                               craft_id, level_id, quantity, bill_rate)
select '61000000-0000-4000-8000-000000000001',
       '60000000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000001',
       1, c.id, l.id, 4, 78.50
  from crafts c, levels l
 where c.code = 'PIPEFITTER' and l.code = 'JOURNEYMAN'
on conflict (id) do nothing;

insert into requisition_lines (id, requisition_id, customer_id, line_number,
                               craft_id, level_id, quantity, bill_rate)
select '61000000-0000-4000-8000-000000000002',
       '60000000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000001',
       2, c.id, l.id, 1, 96.00
  from crafts c, levels l
 where c.code = 'WELDER' and l.code = 'FOREMAN'
on conflict (id) do nothing;

-- --- header credential requirements ------------------------------------
insert into requisition_requirements (requisition_id, credential_id, is_required)
select '60000000-0000-4000-8000-000000000001', id, true
  from credentials where code in ('TWIC','DISA','BASIC_PLUS')
on conflict do nothing;

-- --- line-only requirement (foreman needs the supervisor cert) ----------
insert into requisition_line_requirements (requisition_line_id, credential_id, is_required)
select '61000000-0000-4000-8000-000000000002', id, true
  from credentials where code = 'NCCER'
on conflict do nothing;
