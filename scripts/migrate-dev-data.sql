-- =====================================================================
-- DATA MIGRATION — dev tenant data into this database
-- Generated 2026-09-08 03:00 from https://lqpctvjfdeimldgnhtuz.supabase.co
-- =====================================================================
-- Run once, top to bottom. Every insert is ON CONFLICT DO NOTHING, so a
-- partial re-run is safe.
--
-- NOT copied: portal logins. Each is tied to an auth account that exists
-- only in the source project, so they are recreated through the agency
-- console — which creates the auth account as well. Columns recording who
-- did something resolve to this database's own agency user.
--
-- Craft, level and credential references are resolved by code rather than
-- id: the catalogues were seeded separately in each database and their
-- UUIDs differ.
-- =====================================================================

-- Requires an agency user to exist. Create yours first.
do $$ begin
  if not exists (select 1 from app_users where user_type = 'agency') then
    raise exception 'No agency user in this database. Create your login first.';
  end if;
end $$;

-- 1 customer(s)
insert into customers (id, slug, legal_name, display_name, status, billing_email,
  billing_terms_days, default_markup_pct, requires_internal_approval,
  candidate_approval_required, allow_requester_site_create, show_bill_rates,
  show_worker_contact_info, primary_color, accent_color, notes, created_at)
values ('0c8dd870-baaf-47a9-b004-7980cfb27f22', 'mdelectric', 'M&D Electric', 'M&D Electric',
  'active', null, 30,
  null, false,
  true, false,
  true, true,
  '#1F4E79', '#E87722', null, '2026-09-07T17:04:01.863575+00:00')
on conflict (id) do nothing;

-- 4 site(s)
insert into sites (id, customer_id, name, address_line1, address_line2, city, state,
  postal_code, country, timezone, default_shift, default_hours_per_day,
  default_days_per_week, default_per_diem_rate, default_per_diem_policy,
  badging_lead_time_days, safety_council_required, safety_council_name,
  site_access_notes, default_credential_ids, status, created_by, created_at)
values ('ad3717ef-e07f-47ad-b853-9ae2eec11b13', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'Delek - Hobbs', '674 County Rd 27-A',
  null, 'Hobbs', 'NM', '88240',
  'US', 'America/Chicago', 'day',
  10, 6,
  175, 'daily_worked',
  3, false,
  'DISA', null, '{}'::uuid[],
  'active', (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:23:33.373813+00:00')
on conflict (id) do nothing;
insert into sites (id, customer_id, name, address_line1, address_line2, city, state,
  postal_code, country, timezone, default_shift, default_hours_per_day,
  default_days_per_week, default_per_diem_rate, default_per_diem_policy,
  badging_lead_time_days, safety_council_required, safety_council_name,
  site_access_notes, default_credential_ids, status, created_by, created_at)
values ('e2e9b174-2b57-4423-9138-c6eca054d2f3', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'Energy Transfer - Fannett', '10518 Bill Gaulding Rd',
  null, 'Fannett', 'TX', '77622',
  'US', 'America/Chicago', 'day',
  10, 6,
  135, 'daily_worked',
  3, false,
  'DISA', null, '{}'::uuid[],
  'active', (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:27:05.025955+00:00')
on conflict (id) do nothing;
insert into sites (id, customer_id, name, address_line1, address_line2, city, state,
  postal_code, country, timezone, default_shift, default_hours_per_day,
  default_days_per_week, default_per_diem_rate, default_per_diem_policy,
  badging_lead_time_days, safety_council_required, safety_council_name,
  site_access_notes, default_credential_ids, status, created_by, created_at)
values ('7ac71a01-a234-48b7-926e-def313f6ef76', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'Citgo - Luling', '5036 FM 2984',
  null, 'Luling', 'TX', '78648',
  'US', 'America/Chicago', 'day',
  10, 6,
  135, 'daily_worked',
  3, false,
  'DISA', null, '{}'::uuid[],
  'active', (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:28:46.493627+00:00')
on conflict (id) do nothing;
insert into sites (id, customer_id, name, address_line1, address_line2, city, state,
  postal_code, country, timezone, default_shift, default_hours_per_day,
  default_days_per_week, default_per_diem_rate, default_per_diem_policy,
  badging_lead_time_days, safety_council_required, safety_council_name,
  site_access_notes, default_credential_ids, status, created_by, created_at)
values ('23a7db72-5679-4822-859b-96a4a9382609', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'Energy Transfer - Nederland Terminal', '2780 N Twin City Hwy',
  null, 'Nederland', 'TX', '77627',
  'US', 'America/Chicago', 'day',
  10, 5,
  100, 'daily_worked',
  3, true,
  'ISTC and DISA', null, array[(select id from credentials where code = 'TWIC' and customer_id is null)]::uuid[],
  'active', (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:06:17.578376+00:00')
on conflict (id) do nothing;

-- 4 site contact(s)
insert into site_contacts (id, site_id, customer_id, name, role, phone, email, is_primary, created_at)
values ('3434e2dd-94ee-41f5-aa7c-c6f52f60335d', '23a7db72-5679-4822-859b-96a4a9382609', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'Casey',
  'Site Supervisor', '(409) 622-7075', null, true, '2026-09-07T17:21:23.343114+00:00')
on conflict (id) do nothing;
insert into site_contacts (id, site_id, customer_id, name, role, phone, email, is_primary, created_at)
values ('f41b7ffc-3d4f-4feb-bb13-5dfcbb4abaa4', 'ad3717ef-e07f-47ad-b853-9ae2eec11b13', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'Robert Webb',
  'Superintendent', '(713) 392-2696', null, true, '2026-09-07T17:23:33.627336+00:00')
on conflict (id) do nothing;
insert into site_contacts (id, site_id, customer_id, name, role, phone, email, is_primary, created_at)
values ('5e4fa34e-f4d4-499f-b130-1e09c2e407c4', 'e2e9b174-2b57-4423-9138-c6eca054d2f3', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'Juan Gutierrez',
  'Superintendent', '(409) 617-8093', null, true, '2026-09-07T17:27:05.198296+00:00')
on conflict (id) do nothing;
insert into site_contacts (id, site_id, customer_id, name, role, phone, email, is_primary, created_at)
values ('8c23422b-6363-4d0e-b0f5-717a1f1477f5', '7ac71a01-a234-48b7-926e-def313f6ef76', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'Andres Perez',
  'Superintendent', '(832) 348-9661', null, true, '2026-09-07T17:28:46.718108+00:00')
on conflict (id) do nothing;

-- 6 worker(s)
insert into workers (id, first_name, last_name, preferred_name, email, phone, status,
  home_city, home_state, home_postal_code, willing_to_travel, max_travel_miles,
  per_diem_eligible, primary_craft_id, primary_level_id, years_experience,
  do_not_return, dnr_reason, internal_rating, notes, created_by, created_at)
values ('918f41a6-c66f-4939-ab81-ed1bde915a2c', 'Juan', 'Trevino', null,
  null, '(956) 832-4688', 'available', null,
  null, null, true,
  null, true, (select id from crafts where code = 'ELECTRICIAN'),
  (select id from levels where code = 'APPRENTICE'), 3, false,
  null, null, null, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:52:16.137845+00:00')
on conflict (id) do nothing;
insert into workers (id, first_name, last_name, preferred_name, email, phone, status,
  home_city, home_state, home_postal_code, willing_to_travel, max_travel_miles,
  per_diem_eligible, primary_craft_id, primary_level_id, years_experience,
  do_not_return, dnr_reason, internal_rating, notes, created_by, created_at)
values ('70f7f3f1-7206-4a7e-89e2-6edebeb48177', 'Ismael', 'Hernandez Jr', null,
  null, '(956) 424-5603', 'available', null,
  null, null, true,
  null, true, (select id from crafts where code = 'ELECTRICIAN'),
  (select id from levels where code = 'APPRENTICE'), 5, false,
  null, null, null, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:52:51.710724+00:00')
on conflict (id) do nothing;
insert into workers (id, first_name, last_name, preferred_name, email, phone, status,
  home_city, home_state, home_postal_code, willing_to_travel, max_travel_miles,
  per_diem_eligible, primary_craft_id, primary_level_id, years_experience,
  do_not_return, dnr_reason, internal_rating, notes, created_by, created_at)
values ('3f265f73-f9c5-472a-bfdd-26e062c14a59', 'Giovanni', 'Salazar', null,
  null, '(956) 888-2407', 'available', null,
  null, null, true,
  null, true, (select id from crafts where code = 'ELECTRICIAN'),
  (select id from levels where code = 'JOURNEYMAN'), 7, false,
  null, null, null, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:53:39.363685+00:00')
on conflict (id) do nothing;
insert into workers (id, first_name, last_name, preferred_name, email, phone, status,
  home_city, home_state, home_postal_code, willing_to_travel, max_travel_miles,
  per_diem_eligible, primary_craft_id, primary_level_id, years_experience,
  do_not_return, dnr_reason, internal_rating, notes, created_by, created_at)
values ('21218bb9-31e8-45cd-804d-9365a9596d24', 'Ismael', 'Hernandez', null,
  null, '(956) 510-2511', 'available', null,
  null, null, true,
  null, true, (select id from crafts where code = 'ELECTRICIAN'),
  (select id from levels where code = 'JOURNEYMAN'), 7, false,
  null, null, null, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:54:17.435807+00:00')
on conflict (id) do nothing;
insert into workers (id, first_name, last_name, preferred_name, email, phone, status,
  home_city, home_state, home_postal_code, willing_to_travel, max_travel_miles,
  per_diem_eligible, primary_craft_id, primary_level_id, years_experience,
  do_not_return, dnr_reason, internal_rating, notes, created_by, created_at)
values ('54b77daf-c9de-4bd0-b80b-fa5a606142c2', 'Joel', 'Amaya', null,
  null, '(281) 739-4517', 'available', null,
  null, null, true,
  null, true, (select id from crafts where code = 'ELECTRICIAN'),
  (select id from levels where code = 'APPRENTICE'), 2.5, false,
  null, null, null, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T19:28:49.12002+00:00')
on conflict (id) do nothing;
insert into workers (id, first_name, last_name, preferred_name, email, phone, status,
  home_city, home_state, home_postal_code, willing_to_travel, max_travel_miles,
  per_diem_eligible, primary_craft_id, primary_level_id, years_experience,
  do_not_return, dnr_reason, internal_rating, notes, created_by, created_at)
values ('951c3b76-e87e-40c5-8200-816f0a46625b', 'Luis', 'DeLeon', null,
  null, '(832) 414-0895', 'available', null,
  null, null, true,
  null, true, (select id from crafts where code = 'ELECTRICIAN'),
  (select id from levels where code = 'APPRENTICE'), 2, false,
  null, null, null, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T19:29:22.340769+00:00')
on conflict (id) do nothing;

-- 3 requisition(s)
insert into requisitions (id, customer_id, req_number, site_id, title, project_name,
  po_number, cost_code, status, urgency, start_date, end_date, duration_weeks,
  is_ongoing, shift, shift_start_time, hours_per_day, days_per_week, per_diem_rate,
  per_diem_policy, travel_pay, mobilization_notes, scope_of_work, tools_provided_by,
  ppe_notes, special_instructions, created_by, submitted_by, submitted_at,
  acknowledged_by, acknowledged_at, owner_user_id, needed_by, cancelled_reason,
  closed_at, created_at)
values ('e1ad5489-39be-4cca-b060-94f3a92b8129', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'MDELECTRIC-2026-0001', '7ac71a01-a234-48b7-926e-def313f6ef76',
  null, null, null, null,
  'sourcing', 'standard', '2026-09-08', null,
  8, false, 'day', null,
  10, 6, 135,
  'daily_worked', null, null,
  'Terminal build - new rigid conduit and cable tray.  Followed by cable/wire pulls and terminations.', null, null,
  'FR Clothing needed', (select id from app_users where user_type = 'agency' order by created_at limit 1), (select id from app_users where user_type = 'agency' order by created_at limit 1),
  '2026-09-07T17:40:37.714+00:00', (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:56:01.509+00:00',
  null, null, null,
  null, '2026-09-07T17:40:37.582879+00:00')
on conflict (id) do nothing;
insert into requisitions (id, customer_id, req_number, site_id, title, project_name,
  po_number, cost_code, status, urgency, start_date, end_date, duration_weeks,
  is_ongoing, shift, shift_start_time, hours_per_day, days_per_week, per_diem_rate,
  per_diem_policy, travel_pay, mobilization_notes, scope_of_work, tools_provided_by,
  ppe_notes, special_instructions, created_by, submitted_by, submitted_at,
  acknowledged_by, acknowledged_at, owner_user_id, needed_by, cancelled_reason,
  closed_at, created_at)
values ('84dd3c0e-060f-478c-9279-b0a8cd0e1ce5', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'MDELECTRIC-2026-0002', '23a7db72-5679-4822-859b-96a4a9382609',
  null, null, null, null,
  'submitted', 'standard', '2026-09-08', null,
  null, false, 'day', null,
  10, 5, 100,
  'daily_worked', null, null,
  null, null, null,
  null, (select id from app_users where user_type = 'agency' order by created_at limit 1), (select id from app_users where user_type = 'agency' order by created_at limit 1),
  '2026-09-07T19:17:34.189+00:00', null, null,
  null, null, null,
  null, '2026-09-07T19:17:34.069119+00:00')
on conflict (id) do nothing;
insert into requisitions (id, customer_id, req_number, site_id, title, project_name,
  po_number, cost_code, status, urgency, start_date, end_date, duration_weeks,
  is_ongoing, shift, shift_start_time, hours_per_day, days_per_week, per_diem_rate,
  per_diem_policy, travel_pay, mobilization_notes, scope_of_work, tools_provided_by,
  ppe_notes, special_instructions, created_by, submitted_by, submitted_at,
  acknowledged_by, acknowledged_at, owner_user_id, needed_by, cancelled_reason,
  closed_at, created_at)
values ('2152657c-fbd0-4cb6-821f-9f2af060eb20', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 'MDELECTRIC-2026-0003', 'e2e9b174-2b57-4423-9138-c6eca054d2f3',
  null, null, null, null,
  'acknowledged', 'standard', '2026-09-08', null,
  4, false, 'day', null,
  10, 6, 135,
  'daily_worked', null, null,
  null, null, null,
  null, (select id from app_users where user_type = 'agency' order by created_at limit 1), (select id from app_users where user_type = 'agency' order by created_at limit 1),
  '2026-09-07T19:27:03.464+00:00', (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T19:27:30.674+00:00',
  null, null, null,
  null, '2026-09-07T19:27:03.317459+00:00')
on conflict (id) do nothing;

-- 5 craft line(s)
insert into requisition_lines (id, requisition_id, customer_id, line_number, craft_id,
  level_id, quantity, start_date, end_date, hours_per_day, days_per_week,
  per_diem_rate, bill_rate, target_pay_rate, status, notes, created_at)
values ('fc58265b-63db-4e28-a3db-9b9fa89065f1', 'e1ad5489-39be-4cca-b060-94f3a92b8129', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 1,
  (select id from crafts where code = 'ELECTRICIAN'), (select id from levels where code = 'JOURNEYMAN'), 2, null,
  null, null, null,
  null, null, null,
  'filled', null, '2026-09-07T17:40:37.767748+00:00')
on conflict (id) do nothing;
insert into requisition_lines (id, requisition_id, customer_id, line_number, craft_id,
  level_id, quantity, start_date, end_date, hours_per_day, days_per_week,
  per_diem_rate, bill_rate, target_pay_rate, status, notes, created_at)
values ('dd58c0d7-3bbb-455e-bd3d-343f61fb22f3', 'e1ad5489-39be-4cca-b060-94f3a92b8129', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 2,
  (select id from crafts where code = 'ELECTRICIAN'), (select id from levels where code = 'APPRENTICE'), 2, null,
  null, null, null,
  null, null, null,
  'filled', null, '2026-09-07T17:40:37.767748+00:00')
on conflict (id) do nothing;
insert into requisition_lines (id, requisition_id, customer_id, line_number, craft_id,
  level_id, quantity, start_date, end_date, hours_per_day, days_per_week,
  per_diem_rate, bill_rate, target_pay_rate, status, notes, created_at)
values ('5b650043-09d7-4234-b57c-f24384dab496', '84dd3c0e-060f-478c-9279-b0a8cd0e1ce5', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 1,
  (select id from crafts where code = 'ELECTRICIAN'), (select id from levels where code = 'JOURNEYMAN'), 2, null,
  null, null, null,
  null, null, null,
  'open', null, '2026-09-07T19:17:34.267765+00:00')
on conflict (id) do nothing;
insert into requisition_lines (id, requisition_id, customer_id, line_number, craft_id,
  level_id, quantity, start_date, end_date, hours_per_day, days_per_week,
  per_diem_rate, bill_rate, target_pay_rate, status, notes, created_at)
values ('eeb3a85e-b887-44eb-a99d-71c1b872236b', '84dd3c0e-060f-478c-9279-b0a8cd0e1ce5', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 2,
  (select id from crafts where code = 'ELECTRICIAN'), (select id from levels where code = 'APPRENTICE'), 2, null,
  null, null, null,
  null, null, null,
  'open', null, '2026-09-07T19:17:34.267765+00:00')
on conflict (id) do nothing;
insert into requisition_lines (id, requisition_id, customer_id, line_number, craft_id,
  level_id, quantity, start_date, end_date, hours_per_day, days_per_week,
  per_diem_rate, bill_rate, target_pay_rate, status, notes, created_at)
values ('0f59f503-04ea-45cb-a4f1-d0083031077b', '2152657c-fbd0-4cb6-821f-9f2af060eb20', '0c8dd870-baaf-47a9-b004-7980cfb27f22', 1,
  (select id from crafts where code = 'ELECTRICIAN'), (select id from levels where code = 'APPRENTICE'), 1, null,
  null, null, null,
  null, null, null,
  'filled', null, '2026-09-07T19:27:03.513494+00:00')
on conflict (id) do nothing;

-- 4 credential requirement(s)
insert into requisition_requirements (requisition_id, credential_id, is_required, state_code, notes)
values ('e1ad5489-39be-4cca-b060-94f3a92b8129', (select id from credentials where code = 'DISA' and customer_id is null), true, null, null)
on conflict do nothing;
insert into requisition_requirements (requisition_id, credential_id, is_required, state_code, notes)
values ('84dd3c0e-060f-478c-9279-b0a8cd0e1ce5', (select id from credentials where code = 'TWIC' and customer_id is null), true, null, null)
on conflict do nothing;
insert into requisition_requirements (requisition_id, credential_id, is_required, state_code, notes)
values ('84dd3c0e-060f-478c-9279-b0a8cd0e1ce5', (select id from credentials where code = 'DISA' and customer_id is null), true, null, null)
on conflict do nothing;
insert into requisition_requirements (requisition_id, credential_id, is_required, state_code, notes)
values ('2152657c-fbd0-4cb6-821f-9f2af060eb20', (select id from credentials where code = 'DISA' and customer_id is null), true, null, null)
on conflict do nothing;

-- 5 placement(s)
insert into placements (id, requisition_line_id, requisition_id, customer_id, worker_id,
  stage, stage_changed_at, is_customer_visible, submitted_at, pay_rate, bill_rate,
  per_diem_rate, scheduled_start_date, scheduled_end_date, actual_start_date,
  actual_end_date, end_reason, credential_ready, created_by, created_at)
values ('41910759-347c-42fe-963e-2ec10acc1d80', 'fc58265b-63db-4e28-a3db-9b9fa89065f1', 'e1ad5489-39be-4cca-b060-94f3a92b8129',
  '0c8dd870-baaf-47a9-b004-7980cfb27f22', '21218bb9-31e8-45cd-804d-9365a9596d24', 'confirmed', '2026-09-07T17:57:04.861796+00:00',
  true, null, null,
  null, null, null,
  null, null, null,
  null, false, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:56:47.784072+00:00')
on conflict (id) do nothing;
insert into placements (id, requisition_line_id, requisition_id, customer_id, worker_id,
  stage, stage_changed_at, is_customer_visible, submitted_at, pay_rate, bill_rate,
  per_diem_rate, scheduled_start_date, scheduled_end_date, actual_start_date,
  actual_end_date, end_reason, credential_ready, created_by, created_at)
values ('6c2d4154-3f41-406d-a87b-29d340d4c205', 'fc58265b-63db-4e28-a3db-9b9fa89065f1', 'e1ad5489-39be-4cca-b060-94f3a92b8129',
  '0c8dd870-baaf-47a9-b004-7980cfb27f22', '3f265f73-f9c5-472a-bfdd-26e062c14a59', 'confirmed', '2026-09-07T17:57:30.50819+00:00',
  true, null, null,
  null, null, null,
  null, null, null,
  null, false, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:57:19.34311+00:00')
on conflict (id) do nothing;
insert into placements (id, requisition_line_id, requisition_id, customer_id, worker_id,
  stage, stage_changed_at, is_customer_visible, submitted_at, pay_rate, bill_rate,
  per_diem_rate, scheduled_start_date, scheduled_end_date, actual_start_date,
  actual_end_date, end_reason, credential_ready, created_by, created_at)
values ('38de0437-60e4-4afa-b596-e98bc2df34e9', 'dd58c0d7-3bbb-455e-bd3d-343f61fb22f3', 'e1ad5489-39be-4cca-b060-94f3a92b8129',
  '0c8dd870-baaf-47a9-b004-7980cfb27f22', '70f7f3f1-7206-4a7e-89e2-6edebeb48177', 'confirmed', '2026-09-07T17:57:48.766601+00:00',
  true, null, null,
  null, null, null,
  null, null, null,
  null, false, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:57:41.967728+00:00')
on conflict (id) do nothing;
insert into placements (id, requisition_line_id, requisition_id, customer_id, worker_id,
  stage, stage_changed_at, is_customer_visible, submitted_at, pay_rate, bill_rate,
  per_diem_rate, scheduled_start_date, scheduled_end_date, actual_start_date,
  actual_end_date, end_reason, credential_ready, created_by, created_at)
values ('9d2a5c3b-e24b-4170-8557-0b3bb5742ade', 'dd58c0d7-3bbb-455e-bd3d-343f61fb22f3', 'e1ad5489-39be-4cca-b060-94f3a92b8129',
  '0c8dd870-baaf-47a9-b004-7980cfb27f22', '918f41a6-c66f-4939-ab81-ed1bde915a2c', 'confirmed', '2026-09-07T17:58:01.978862+00:00',
  true, null, null,
  null, null, null,
  null, null, null,
  null, false, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T17:57:54.684101+00:00')
on conflict (id) do nothing;
insert into placements (id, requisition_line_id, requisition_id, customer_id, worker_id,
  stage, stage_changed_at, is_customer_visible, submitted_at, pay_rate, bill_rate,
  per_diem_rate, scheduled_start_date, scheduled_end_date, actual_start_date,
  actual_end_date, end_reason, credential_ready, created_by, created_at)
values ('ea488abb-c2e3-4db8-a092-105c9194dfc4', '0f59f503-04ea-45cb-a4f1-d0083031077b', '2152657c-fbd0-4cb6-821f-9f2af060eb20',
  '0c8dd870-baaf-47a9-b004-7980cfb27f22', '951c3b76-e87e-40c5-8200-816f0a46625b', 'confirmed', '2026-09-07T19:30:11.773246+00:00',
  true, null, null,
  null, null, null,
  null, null, null,
  null, false, (select id from app_users where user_type = 'agency' order by created_at limit 1), '2026-09-07T19:29:53.759593+00:00')
on conflict (id) do nothing;

-- Carry the numbering forward so the next request does not reuse a number
insert into req_number_counters (customer_id, year, last_value)
values ('0c8dd870-baaf-47a9-b004-7980cfb27f22', 2026, 3)
on conflict (customer_id, year) do update set last_value = greatest(req_number_counters.last_value, excluded.last_value);

-- Recompute the fill counts from the placements just inserted.
update requisition_lines l set filled_count = filled_count;

select 'customers' as t, count(*) from customers
union all select 'sites', count(*) from sites
union all select 'workers', count(*) from workers
union all select 'requisitions', count(*) from requisitions
union all select 'requisition_lines', count(*) from requisition_lines
union all select 'placements', count(*) from placements;
