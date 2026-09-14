-- DriftCheck schema — migration 0001 (applied to Supabase Postgres)
-- idempotent; safe against re-run.

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  biomarker text not null check (biomarker in ('hemoglobin','tsh','creatinine')),
  value numeric not null check (value > 0),
  unit text not null,
  measured_on date not null,
  source text not null default 'manual' check (source in ('manual','lab_api')),
  reported_at timestamptz not null default now()
);

create index if not exists idx_results_patient_marker_date
  on public.results (patient_id, biomarker, measured_on desc);

-- Audit trail of every scoring decision + the inputs that produced it.
create table if not exists public.check_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  result_id uuid not null references public.results(id) on delete cascade,
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
  created_at timestamptz not null default now()
);

create index if not exists idx_check_events_patient
  on public.check_events (patient_id, created_at desc);

-- Row Level Security: each patient only ever sees their own rows.
alter table public.patients enable row level security;
alter table public.results enable row level security;
alter table public.check_events enable row level security;

drop policy if exists "patients manage own profile" on public.patients;
create policy "patients manage own profile" on public.patients
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "patients read own results" on public.results;
create policy "patients read own results" on public.results
  for select
  using (auth.uid() = patient_id);

drop policy if exists "patients insert own results" on public.results;
create policy "patients insert own results" on public.results
  for insert
  with check (auth.uid() = patient_id);

drop policy if exists "patients read own check events" on public.check_events;
create policy "patients read own check events" on public.check_events
  for select
  using (auth.uid() = patient_id);

-- TODO(prod): doctor read-only access via a 'doctor' claim check
--   using (exists (select 1 from public.patient_doctors pd
--                   where pd.doctor_id = auth.uid() and pd.patient_id = check_events.patient_id))
-- TODO(prod): insertion of check_events is done by a trusted Edge Function
--   (service role), not by clients — add a service-role bypass policy when wired.