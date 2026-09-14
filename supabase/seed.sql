-- DriftCheck schema (Supabase PostgreSQL)
-- For the hackathon this is the *production* shape — the live demo runs entirely
-- client-side via the pure checkDrift() module so the pitch never depends on network.

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,            -- Twilio SMS target (patient)
  email text,                   -- Resend email target (optional)
  created_at timestamptz default now()
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  biomarker text not null check (biomarker in ('hemoglobin','tsh','creatinine')),
  value numeric not null,
  unit text not null,
  measured_on date not null,
  source text not null default 'manual',   -- 'manual' | 'lab_api' (future partners)
  reported_at timestamptz default now()
);
create index if not exists idx_results_patient_marker_date
  on results (patient_id, biomarker, measured_on desc);

-- Audit log of every scoring decision, with the inputs that produced it.
create table if not exists check_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  result_id uuid not null references results(id),
  flag text not null check (flag in ('sudden','drift','normal')),
  z_score numeric,
  slope numeric,
  r_squared numeric,
  total_change numeric,
  personal_mean numeric,
  personal_stddev numeric,
  personal_min numeric,
  personal_max numeric,
  notified_sms boolean not null default false,
  notified_email boolean not null default false,
  created_at timestamptz default now()
);

-- Candidate trigger flow (reference): after a result lands,
-- the 4 prior values + the new one feed checkDrift() (mirrored in SQL or an
-- Edge Function), write a check_events row, and fire notify-on-flag for
-- non-'normal' flags.
-- Trigger → notify-on-flag Edge Function → Twilio (SMS) for 'sudden',
-- Resend (email) for 'drift' digest queue.

-- pg_cron: nightly 8 AM digest of open drift flags to patient + doctor emails.
select cron.schedule(
  'driftcheck-daily-digest',
  '0 8 * * *',
  $$ select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/daily-digest',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || current_setting('app.settings.service_role'),
         'Content-Type', 'application/json'
       ),
       body := '{}'
     ); $$
);