-- =====================================================================
-- IMPORT — M&D Electric job log
-- 59 jobs from "M&D Electric_Job Information Log_8.24.26 (2).xlsx"
-- =====================================================================
-- Safe to re-run: keyed on (customer_id, job_number), existing rows are
-- updated rather than duplicated.
-- =====================================================================

do $$
declare v_customer uuid;
begin
  select id into v_customer from customers where slug = 'mdelectric';
  if v_customer is null then
    raise exception 'No customer with slug mdelectric in this database';
  end if;

  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3275', '2024-11-04'::date, 'On Hold',
    'ETP Nederland', 'Flexport Dock #1 & #7', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Robert Webb', '713-392-2696',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3459', '2025-10-29'::date, 'On Hold',
    'Energy Transfer', 'NTP to ETF Meter Station', 'NTP Meter Station', 'Abilene, TX', null,
    'Matt Brackett', 'Juan Gutierrez', '409-617-8093',
    150, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3493', '2026-01-07'::date, 'Active',
    'Chevron Pipeline', 'Meter Station Analyzer SOW', 'Orange Meter Station', '2880 Foreman Rd (Orange, TX)', null,
    'Brent Louviere', 'Andres Perez', '832-348-9661',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3498', '2026-01-16'::date, 'Active',
    'FHG', 'Citgo Luling Terminal Reactivation Phase 2', 'Citgo Luling Terminal', '5036 FM 2984 (Luling, TX 78648)', null,
    'Travis Fasulo', 'Andres Perez', '832-348-9661',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3502', '2026-01-28'::date, 'Active',
    'Delek', 'Nettleton Tank Replacement', 'Nettleton Station', 'E Texaco Rd (Longview, TX 75604)', null,
    'Travis Fasulo', 'Juan Gutierrez', '409-617-8093',
    150, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3520', '2026-02-24'::date, 'Complete',
    'Delek', 'Honcho Pipeline I&E', 'Outland 1 CTB Site', 'Lea County, NM', null,
    'Matt Brackett', 'Robert Webb', '713-392-2696',
    150, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3523', '2026-03-04'::date, 'Active',
    'ETP Mont Belvieu', 'NT Ethylene Storage Upgrade', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3527', '2026-03-17'::date, 'Active',
    'Duphil', 'CPL Meter Station Permanent Power', 'Orange Meter Station', '2880 Foreman Rd (Orange, TX)', null,
    'Brent Louviere', 'Andres Perez', '832-348-9661',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3530', '2026-03-19'::date, 'Active',
    'ETP Mont Belvieu', 'Spindletop PLC UPS Power', 'ETP Spindletop', '6876 Erie St (Beaumont, TX 77705)', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3532', '2026-03-23'::date, 'Complete',
    'ETP Nederland', 'Butane Bottleneck', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3540', '2026-04-21'::date, 'Complete',
    'ETP Nederland', 'Main Road Lighting Repair', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3541', '2026-04-23'::date, 'Complete',
    'ETP Mont Belvieu', '6ST Work Over', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3543', '2026-04-24'::date, 'Active',
    'ETP Nederland', 'Tank 1558', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3545', '2026-04-28'::date, 'Complete',
    'ETP Nederland', 'Construction Assistance', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3547', '2026-04-29'::date, 'Complete',
    'Delek', 'El Arroyo', 'El Arroyo CTB', 'Howard County, TX (Big Spring, TX)', null,
    'Matt Brackett', 'Robert Webb', '713-392-2696',
    150, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3554', '2026-05-13'::date, 'Complete',
    'ETP Mont Belvieu', '14NT Well Workover', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3555', '2026-05-13'::date, 'Active',
    'ETP Mont Belvieu', 'Brine Resalinization Phase 1', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3556', '2026-05-18'::date, 'Active',
    'ETP Mont Belvieu', 'Bethel Leaching Phase 1', 'Bethel Leach Plant', '1919 Anderson CR 2608 (Tennessee Colony, TX 75861)', null,
    'Travis Fasulo', 'Juan Gutierrez', '409-617-8093',
    150, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3557', '2026-05-19'::date, 'Active',
    'Non-Typical Pipeline', 'ETP-Sabina 2 Booster Station (Hwy 61)', 'Hwy 61 Station', 'Liberty County, TX (Hankamer, TX)', null,
    'Matt Brackett', 'Juan Gutierrez', '409-617-8093',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3558', '2026-05-19'::date, 'Active',
    'Non-Typical Pipeline', 'ETP-Sabina 2 Booster Station (Fannett)', 'Fannett Station', 'Jefferson County, TX (Fannett, TX)', null,
    'Matt Brackett', 'Juan Gutierrez', '409-617-8093',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3559', '2026-05-19'::date, 'Active',
    'Chevron Pipeline', 'Lion Polymer BDFS Trap Project', 'Lion Polymers', 'Orange, TX', null,
    'Brent Louviere', 'Andres Perez', '832-348-9661',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3560', '2026-05-19'::date, 'Active',
    'Chevron Pipeline', 'BDFS Skid Revision', 'Orange Meter Station', '2880 Foreman Rd (Orange, TX)', null,
    'Brent Louviere', 'Andres Perez', '832-348-9661',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3562', '2026-05-21'::date, 'Complete',
    'ETP Nederland', 'Central Manifold Valve Addition', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3563', '2026-05-21'::date, 'Active',
    'ETP Nederland', 'Tank 1547', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3566', '2026-05-26'::date, 'Complete',
    'Energy Transfer', 'Hebert Nitrogen Panel Upgrade', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Brandon Murphy', '409-658-9771',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3570', '2026-06-02'::date, 'Active',
    'Energy Transfer', 'P106 Booster Pump Station', 'FM 1410 Pump Station', 'FM 1410 (Winnie, TX)', null,
    'Matt Brackett', 'Jose Cardenas', '346-216-9859',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3573', '2026-06-10'::date, 'Complete',
    'ETP Mont Belvieu', 'Exxon Ethylene Connectivity', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3575', '2026-06-12'::date, 'Active',
    'Non-Typical Pipeline', 'ETP MB Frac IX Duct Bank', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3577', '2026-06-12'::date, 'Active',
    'ETP Mont Belvieu', 'Ethane Transfer Pump', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3580', '2026-06-24'::date, 'Active',
    'ETP Mont Belvieu', 'EP3 Ethane Skid Tubing Install', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3581', '2026-06-24'::date, 'Complete',
    'ETP Mont Belvieu', '7ST Well Head Work Over', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3582', '2026-06-24'::date, 'Complete',
    'ETP Nederland', 'Lube Warehouse Fiber Reroute', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3583', '2026-06-25'::date, 'Active',
    'ETP Mont Belvieu', 'Frac IX OSBL', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3585', '2026-06-26'::date, 'Active',
    'ETP Mont Belvieu', 'Frac IX Temporary Generator', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3586', '2026-07-02'::date, 'Active',
    'ETP Mont Belvieu', 'Delta V 120v Utility Circuits', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3587', '2026-07-02'::date, 'Active',
    'ETP Nederland', 'Matrix Temp Trailer Power Rev 2', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3588', '2026-07-02'::date, 'Complete',
    'ETP Nederland', 'Tank 1549 Demo', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3589', '2026-07-06'::date, 'Active',
    'ETP Mont Belvieu', '2ST Well Work Over', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3590', '2026-07-08'::date, 'Active',
    'ETP Mont Belvieu', 'P-7960 LEP to P-213', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3592', '2026-07-16'::date, 'Active',
    'SETEX', 'Temp Power to Office Trailers', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Brandon Murphy', '409-658-9771',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3593', '2026-07-17'::date, 'Complete',
    'Non-Typical Pipeline', 'Frac IX Foundation Ground Tails', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3594', '2026-07-20'::date, 'Complete',
    'ETP Nederland', 'Rotation MOV Addition', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3595', '2026-07-23'::date, 'Complete',
    'ETP Nederland', 'Engineering Trailer Disconnect', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3597', '2026-07-24'::date, 'Active',
    'ETP Nederland', 'Dock House 4 Transformer Replacement', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brandon Murphy', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3598', '2026-07-28'::date, 'Active',
    'Delek', 'Tagalong 3 Switch Rack', 'Libby Gas Plant', 'Sour Lake, TX (M&D Electric)', null,
    'Travis Fasulo', 'Travis Fasulo', '409-782-5681',
    0, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3599', '2026-07-28'::date, 'Active',
    'ETP Nederland', 'Injection Motors', 'Nederland Terminal', '2300 N Twin City Hwy (Nederland, TX)', null,
    'Brent Louviere', 'Casey Rawls', '409-622-7075',
    100, true)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3600', '2026-07-29'::date, 'Complete',
    'GR Birdwell', 'Air Liquide Grounding Repairs', 'Air Liquide Bay City Terminal', 'Bay City, TX', null,
    'Travis Fasulo', 'Edgar Cano', '281-425-9857',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3601', '2026-08-04'::date, 'Active',
    'ETP Mont Belvieu', 'Bethel Temp Control Room Power', 'Bethel Leach Plant', '1919 Anderson CR 2608 (Tennessee Colony, TX 75861)', null,
    'Travis Fasulo', 'TBD', '135',
    null, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3602', '2026-08-13'::date, 'Active',
    'ETP Mont Belvieu', 'ETBX Leach Plant Ph 2 Electrical Rack (Bethel)', 'Bethel Leach Plant', '1919 Anderson CR 2608 (Tennessee Colony, TX 75861)', null,
    'Travis Fasulo', 'TBD', '135',
    null, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3603', '2026-08-17'::date, 'Complete',
    'REI', 'Fiber Assistance', 'Howard Energy', 'Port Arthur, TX', null,
    'Brent Louviere', 'Fernando Rincon', '281-839-8704',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3604', '2026-08-17'::date, 'Complete',
    'GR Birdwell', 'Air Liquide Port Neches Conduit Reroute', 'Air Liquide Port Neches Site', 'Port Neches, TX', null,
    'Travis Fasulo', 'Casey Rawls', '409-622-7075',
    100, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3605', '2026-08-17'::date, 'Active',
    'ETP Mont Belvieu', 'ETBX Ph 2 Cable Tray', 'Bethel Leach Plant', '1919 Anderson CR 2608 (Tennessee Colony, TX 75861)', null,
    'Travis Fasulo', 'Juan Gutierrez', '409-617-8093',
    0, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3606', '2026-08-18'::date, 'Active',
    'Delek', 'Libby Tag-A-Long', 'Libby Gas Plant', '674 CR 27-A (Hobbs, NM 88240)', null,
    'TBD', 'Robert Webb', '713-392-2696',
    175, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3607', '2026-08-18'::date, 'Active',
    'ETP Mont Belvieu', 'Justice Filters', 'Lone Star NGL', 'Mont Belvieu, TX', null,
    'Travis Fasulo', 'Luis Trejo', '281-827-2287',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3608', '2026-08-19'::date, 'Active',
    'Duphil', 'ONEOK - CP Chem Meter Site', 'Orange Meter Station', '2880 Foreman Rd (Orange, TX)', null,
    'Matt Brackett', 'Robert Webb', '713-392-2696',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3609', '2026-08-19'::date, 'Active',
    'Chevron Pipeline', 'PA Off-Test Ethylene (Fannett Trap Skid)', 'Fannett Station', '16151 Craigen Rd (Fannett, TX)', null,
    'Brent Louviere', 'Fernando Rincon', '281-839-8704',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3610', '2026-08-19'::date, 'Active',
    'Chevron Pipeline', 'PA Off-Test Ethylene (PH138 Meter Skid)', 'Port Arthur Plant', '2003 S Gulfway Dr (Port Arthur, TX)', null,
    'Brent Louviere', 'Fernando Rincon', '281-839-8704',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3611', '2026-08-19'::date, 'Active',
    'Marathon', 'CTB 613 McCloy Ranch', 'McCloy Ranch', 'N/A', null,
    'Brent Louviere', 'Byron Linscomb', '409-679-8972',
    0, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
  insert into customer_jobs (customer_id, job_number, date_created, status,
    end_customer, description, site_name, location, gps_coordinates,
    project_manager, site_contact_name, site_contact_phone, per_diem_rate, twic_required)
  values (v_customer, '3612', '2026-08-24'::date, 'Active',
    'Duphil', '35kv Termination Failure @ OSBL', 'GTP OSBL Manifold', '2424 Foreman Rd (Orange, TX)', null,
    'Brent Louviere', 'Andres Perez', '832-348-9661',
    135, false)
  on conflict (customer_id, job_number) do update set
    status = excluded.status, end_customer = excluded.end_customer,
    description = excluded.description, site_name = excluded.site_name,
    location = excluded.location, project_manager = excluded.project_manager,
    site_contact_name = excluded.site_contact_name,
    site_contact_phone = excluded.site_contact_phone,
    per_diem_rate = excluded.per_diem_rate, twic_required = excluded.twic_required;
end $$;

select status, count(*) from customer_jobs group by status order by 1;