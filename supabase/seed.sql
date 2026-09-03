-- =====================================================================
-- SEED — global reference data
-- Safe to re-run: every insert is ON CONFLICT DO NOTHING.
-- This is catalog data, not test data. Tenant/test fixtures belong in
-- supabase/fixtures/ so they never reach production.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Crafts. Trim or extend to match what US Trades actually places.
-- ---------------------------------------------------------------------
insert into crafts (code, name, category, sort_order) values
  ('PIPEFITTER',    'Pipefitter',            'Mechanical',  10),
  ('WELDER',        'Welder',                'Mechanical',  20),
  ('BOILERMAKER',   'Boilermaker',           'Mechanical',  30),
  ('MILLWRIGHT',    'Millwright',            'Mechanical',  40),
  ('RIGGER',        'Rigger',                'Mechanical',  50),
  ('ELECTRICIAN',   'Electrician',           'Electrical',  60),
  ('INSTRUMENT',    'Instrument Technician', 'Electrical',  70),
  ('SCAFFOLD',      'Scaffold Builder',      'Civil',       80),
  ('INSULATOR',     'Insulator',             'Civil',       90),
  ('CARPENTER',     'Carpenter',             'Civil',      100),
  ('IRONWORKER',    'Ironworker',            'Civil',      110),
  ('PAINTER',       'Painter / Blaster',     'Civil',      120),
  ('LABORER',       'General Laborer',       'Support',    130),
  ('OPERATOR',      'Equipment Operator',    'Support',    140),
  ('FIREWATCH',     'Fire Watch / Hole Watch','Support',   150),
  ('QC_INSPECTOR',  'QA/QC Inspector',       'Quality',    160),
  ('SAFETY_TECH',   'Safety Technician',     'Safety',     170)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Levels. `rank` drives sorting and "does this worker meet the ask" logic,
-- so leave gaps between values to allow inserts later.
-- ---------------------------------------------------------------------
insert into levels (code, name, rank) values
  ('APPRENTICE',      'Apprentice',       10),
  ('HELPER',          'Helper',           20),
  ('JOURNEYMAN',      'Journeyman',       30),
  ('LEAD',            'Lead',             40),
  ('FOREMAN',         'Foreman',          50),
  ('GENERAL_FOREMAN', 'General Foreman',  60),
  ('SUPERINTENDENT',  'Superintendent',   70)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Global credential catalog (customer_id is null = available to all tenants).
-- Tenant-specific credentials are added per customer at onboarding.
-- ---------------------------------------------------------------------
insert into credentials
  (code, name, short_label, kind, issuing_body, has_expiration,
   default_valid_days, requires_document, requires_number, requires_state,
   verification, sort_order)
values
  ('TWIC', 'Transportation Worker Identification Credential', 'TWIC Card',
   'card', 'TSA', true, 1825, true, true, false, 'document_upload', 10),

  ('DISA', 'DISA Consortium Membership / Drug Screen', 'DISA',
   'screening', 'DISA Global Solutions', true, 365, false, true, false,
   'third_party_lookup', 20),

  ('OSHA_10', 'OSHA 10-Hour Construction', 'OSHA 10',
   'training', 'OSHA', false, null, true, true, false, 'document_upload', 30),

  ('OSHA_30', 'OSHA 30-Hour Construction', 'OSHA 30',
   'training', 'OSHA', false, null, true, true, false, 'document_upload', 40),

  ('NCCER', 'NCCER Craft Certification', 'NCCER',
   'certification', 'NCCER', false, null, true, true, false,
   'third_party_lookup', 50),

  ('TWIC_ESCORT', 'TWIC Escort Trained', 'TWIC Escort',
   'training', null, true, 365, true, false, false, 'agency_verified', 60),

  ('BASIC_PLUS', 'Basic Plus Safety Council', 'Basic Plus',
   'training', 'Safety Council', true, 365, true, true, false,
   'document_upload', 70),

  ('CONFINED_SPACE', 'Confined Space Entry', 'Confined Space',
   'training', null, true, 365, true, false, false, 'document_upload', 80),

  ('FALL_PROTECTION', 'Fall Protection', 'Fall Protection',
   'training', null, true, 365, true, false, false, 'document_upload', 90),

  ('RESPIRATOR_FIT', 'Respirator Fit Test', 'Fit Test',
   'medical', null, true, 365, true, false, false, 'document_upload', 100),

  ('PHYSICAL', 'DOT / Site Physical', 'Physical',
   'medical', null, true, 730, true, false, false, 'document_upload', 110),

  ('BACKGROUND', 'Background Check', 'Background',
   'screening', null, true, 365, false, false, false, 'third_party_lookup', 120),

  ('STATE_LICENSE', 'State Trade License', 'State License',
   'license', null, true, null, true, true, true, 'document_upload', 130),

  ('DRIVERS_LICENSE', 'Driver License', 'Driver License',
   'license', null, true, null, true, true, true, 'document_upload', 140),

  ('CDL', 'Commercial Driver License', 'CDL',
   'license', null, true, null, true, true, true, 'document_upload', 150),

  ('WELD_CERT', 'Welder Qualification / WPS', 'Weld Cert',
   'certification', null, true, 180, true, true, false, 'agency_verified', 160),

  ('CRANE_CERT', 'NCCCO Crane Operator', 'NCCCO',
   'certification', 'NCCCO', true, 1825, true, true, false,
   'third_party_lookup', 170),

  ('H2S', 'H2S Awareness', 'H2S',
   'training', null, true, 365, true, false, false, 'document_upload', 180)
on conflict do nothing;
