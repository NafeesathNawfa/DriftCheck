# DriftCheck — Implementation Plan

> **Status:** Idea pitched (PPT round passed). This file is the build-plan for the 24-hour hackathon, the tech stack, the architecture, and the production deployment path. The decision-forcing question at every screen:

> **"Does this new blood test result fit the patient's OWN history — not just the population 'normal' band?"**

---

## 1. One-line pitch (recap)

DriftCheck checks whether a new blood test result fits **your own history** — not just the "normal" range everyone gets compared to — so a slow decline that never leaves the normal range doesn't get lost between appointments.

**Example that carries the demo:** hemoglobin `14.5 → 14.0 → 13.6 → 13.2 → 12.9` g/dL. Every result stays inside the printed "normal" band (12.0–16.0), so no report ever flags it. Against the patient's own pattern it is clearly drifting: r² = 0.99, total change −1.6 g/dL over five checks.

### Goals
- A working web app where a patient enters 4 past values + a new result for a biomarker.
- The app computes the patient's **personal baseline** (mean of their own history) and **personal band** (mean ± 2σ of their own history).
- Flags one of three outcomes in plain English: `sudden` | `drift` | `normal`.
- A trend chart showing the 5 points, the population "normal" band, and the personal band/average side by side.
- Persistent, non-dismissible disclaimer on every screen: **this is not a diagnosis**.

### Non-goals (24-hr scope, deliberate)
- No OCR / PDF parsing — lab values are manually entered (one-click demo fixtures instead).
- No trained ML — the comparison is transparent statistics (z-score + simple linear regression).
- No real lab integration — demo is fully self-contained; Supabase/Twilio/Resend are the **production** path, documented but not required for the pitch.

---

## 2. Tech stack — and the reasoning for EVERY choice

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| Language | **TypeScript (all layers)** | One type system across logic module, UI, and Edge Functions (Deno). The scoring module is the product — it must be testable and typed end-to-end. `<any>` is the enemy for live demos. |
| UI framework | **React 18 + Vite 5** | Fastest iteration loop for 24h; Vite dev server is instant, and the React ecosystem (recharts) is exactly what the trend chart needs. No Next.js — a SPA is enough and has zero server rendering risk live. |
| Charting | **recharts** | Declarative, ~15 lines for a line chart, and — critically — supports `ReferenceArea` for shading the population "normal" band and `ReferenceLine` for the personal average. That visual contrast *is* the pitch. |
| Styling | **Plain CSS (one file)** | Zero build risk, zero purge config, zero plugin version hell at hour 23. A `chip`, a `card`, a `flag` banner and a fixed footer is all the design system this app has. Tailwind adds risk with no demo payoff this late. |
| Routing | **`useState<'input'\|'check'\|'result'>`** | Four screens, one demo flow. A router is ceremony, not value, at 24h. Also makes the "analyzing" transition trivial to time. |
| Testing | **Vitest** (colocated `*.test.ts`) | Same Vite config — zero extra setup, watches `checkDrift.ts` hot-reload. The tests double as the algorithm's spec for the judges. |
| Backend (production) | **Supabase** | Postgres + built-in Auth + Deno Edge Functions + `pg_cron` in one product; generous free tier; RLS row-level security maps 1:1 to "each patient sees only their own results". Beats assembling Postgres + Lambda + cron + auth separately. |
| SMS (production) | **Twilio** | The only channel that reliably reaches Indian patients (including feature phones) for time-critical "sudden" flags; per-message pricing with nothing to operate; delivery receipts. |
| Email (production) | **Resend** | Simple REST API, DKIM out-of-the-box, 12,000 free emails/month in its free tier — more than enough for a beta of flagged-trend digests to patients and doctors. No SMTP server to run. |
| Hosting | **Vercel** | `git push` → deployed; global edge; free tier covers the prototype; zero DevOps time during the hackathon. |

### Why the scoring runs CLIENT-SIDE for the demo (and server-side later)

The pitch happens live, in a room, on a laptop/room WiFi. The scoring must produce a result **even if the network fails**, and it must be **explainable second-by-second**. So the core is a pure module that runs in the browser with **zero network calls**. This is a deliberate resilience decision, not an architectural shortcut:

- Demo path: `Input → checkDrift() (pure TS, in-browser) → Result`. Deterministic, instant, always up.
- Production path: the **same** scoring logic is mirrored in a Supabase Edge Function so every result is re-scored server-side, written to `check_events` (audit trail), and triggers notifications. The algorithm is ~80 lines of pure math — mirroring it in Deno is trivial and keeps the client honest.

The judge-defensible phrasing: *"The flag you see is computed in your browser — no latency, no dependencies, fully auditable. In production the identical function runs server-side so the decision and the notification are trusted."*

---

## 3. Architecture diagrams

### 3a. Live demo (what runs on stage — zero network)

```
┌────────────────────────────────────────────────────────────┐
│  Browser  (Vite dev / static export, no backend needed)    │
│                                                            │
│  InputScreen ──► checkDrift(past, newValue)  ──► Result    │
│  (4 past + 1)        │  pure TS module                     │
│  one-click demo      └─ 1. z-score vs personal mean/σ      │
│  fixtures                 (|z| > 2.5 → 'sudden')           │
│                         2. linear regression over 5 pts    │
│                             (|Δ| ≥ 1.0 && r² ≥ 0.6 →      │
│                              'drift')                      │
│                         3. 'sudden' wins over 'drift'      │
│                   TrendChart (recharts): 5 points,         │
│                   pop "normal" band + personal band/avg    │
│                   Disclaimer sticky footer on all screens  │
└────────────────────────────────────────────────────────────┘
```

### 3b. Production (post-hackathon target)

```
┌───────────────┐        ┌──────────────────────────────────────────┐
│ React SPA     │ HTTPS  │ Supabase                                 │
│ (Vercel edge) ├───────►│ ├─ Auth (email OTP / phone)              │
│ patients +    │        │ ├─ Postgres                              │
│ doctors log   │        │ │   patients · results · check_events    │
│ in, enter /   │        │ ├─ Edge Function run-drift-check         │
│ view results  │        │ │    (mirrors browser scoring, writes    │
└───────────────┘        │ │     audit rows, RLS-policied)          │
                         │ └─ pg_cron (08:00 daily digest job)      │
                         └───────────────┬──────────────────────────┘
                      non-'normal' flag  │
                                         ▼
                        ┌────────────────────────────────┐
                        │ Edge Function notify-on-flag   │
                        │  ──► Twilio SMS  (patient,     │
                        │       only on 'sudden')        │
                        │  ──► Resend email (doctor:     │
                        │       pre-flagged trend        │
                        │       summary / nightly digest)│
                        └────────────────────────────────┘
```

### 3c. Notification decision matrix

| Flag | Immediate SMS (Twilio) | Email (Resend) | Who |
|------|------------------------|----------------|-----|
| `sudden` | ✅ yes (acute change — time matters) | ✅ doctor alert | patient + doctor |
| `drift` | ❌ (queued / weekly opt-in) | ✅ nightly digest + appointment summary | patient + doctor |
| `normal` | — | ⏳ optional monthly reassurance digest | patient |

Rationale: **SMS is reserved for `sudden`** — flooding a chronic-care patient with SMS for gradual drifts destroys trust and costs money. Drifts are exactly what the *email digest at doctor-visit time* and the *weekly patient email* are for. This "channel grades with urgency" mapping is a strong judging story.

---

## 4. The scoring algorithm — implementation & tuning (Person A)

### 4.1 Reference ranges used (only to know what "normal" looks like — the algorithm never compares to them)

| Biomarker | Population "normal" band | Unit | Concerning direction |
|-----------|--------------------------|------|----------------------|
| Hemoglobin | 12.0 – 16.0 | g/dL | lower |
| TSH | 0.4 – 4.0 | mIU/L | either |
| Creatinine | 0.6 – 1.2 | mg/dL | higher |

### 4.2 Demo fixtures (lock these early — everything depends on them)

```ts
// src/lib/demoStories.ts
export const demoStories = {
  hemoglobin:  { past: [14.5, 14.0, 13.6, 13.2], new: 12.9 },  // → drift
  tsh:         { past: [ 2.1,  3.4,  1.9,  3.0], new:  2.5 },  // → normal
  creatinine:  { past: [ 0.9, 0.95, 0.92, 0.91], new:  1.8 },  // → sudden
};
```

### 4.3 Two checks; sudden wins every tie

**Check A — sudion change, z-score against the patient's OWN distribution:**

```
mean    = mean(past)                      // personal baseline
stddev  = stddev(past)                    // personal month-to-month spread
z       = |new − mean| / stddev           // if stddev === 0 (4 identical pasts),
                                          //   treat any difference as z = ∞
sudden  = z > 2.5
```

**Check B — gradual drift, linear regression over all 5 points (x = visit index):**

```
slope     = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²
rSquared  = (Σ(x−x̄)(y−ȳ))² / (Σ(x−x̄)² · Σ(y−ȳ)²)   // consistency of direction
totalChange = last − first
drift = |totalChange| ≥ 1.0  AND  rSquared ≥ 0.6
```

**Priority:** `sudden` > `drift` > `normal`.

### 4.4 Threshold tuning log (the "why these numbers" answer for judges)

| Threshold | Tried | Result | Verdict |
|-----------|-------|--------|---------|
| `suddenZ = 2.0` | hemoglobin latest 12.9 → z ≈ **1.92**; creatinine → z ≈ **47** | Hemoglobin *just* misses (good), but a presenter typing 12.8 live → z ≈ 2.13 **flips to 'sudden'** | ✗ too close to the edge for a live demo |
| `suddenZ = 2.5` | hemoglobin → 1.92, perturbed 12.7 → 2.34; TSH → 0.16; creatinine → 47 | All correct, big margins | ✓ **"outside ~99% of the band your own history implies"** |
| `driftAbsChange = 1.0` | hemoglobin Δ = −1.6 → drift ✓; TSH Δ = +0.4 → no ✓; creatinine Δ = +0.9 → no ✓ | All correct | ✓ |
| `driftR2 = 0.6` | hemoglobin r² = 0.99 → drift ✓; TSH r² = 0.01 → noise ✓; creatinine r² = 0.50 → not drift ✓ | Filters noise, keeps real trend | ✓ |

**Margins after tuning** (rounded): hemoglobin z=1.92 → “drift”, TSH z=0.16/Δ=0.4 → “normal”, creatinine z≈47 → “sudden”. Perturbation test in `checkDrift.test.ts` proves small live-typing variance (14.4→12.8 etc.) never flips a result.

### 4.5 Defensive hardening (hour 5–6)
- `stddev === 0` (four identical past values) → divide-by-zero guard.
- Empty / `NaN` input → returns `flag:'normal', enoughData:false` — never throws.
- Caller (`App.runCheck`) wraps in try/catch as belt-and-braces.
- Output includes personal band (mean ± 2σ), slope, z, r² — everything printed so the flag is auditable on screen.

---

## 5. Repo layout

```
medithon/
├── PLAN.md
├── README.md
├── package.json  tsconfig*.json  vite.config.ts  index.html
├── src/
│   ├── main.tsx  App.tsx  index.css  vite-env.d.ts
│   ├── lib/            checkDrift.ts · checkDrift.test.ts · demoStories.ts
│   ├── data/           biomarkers.ts
│   └── components/     InputScreen · CheckScreen · ResultScreen · TrendChart · DisclaimerBanner
└── supabase/
    ├── seed.sql                              (production schema)
    └── functions/notify-on-flag/index.ts     (Twilio SMS + Resend email)
```

Screens: `Input → Check → Result`, with the **disclaimer banner present on all three** (sticky footer).

---

## 6. UX / screen spec (Person B + C)

1. **Input** — Three biomarker chips (Hemoglobin / TSH / Creatinine). Tapping one loads its demo story into the five fields in **one click** (judges never type). Fields are editable after loading. Population "normal" range shown per marker. "Check [marker]" runs the analysis.
2. **Check** — ~1.4 s "Building your personal baseline…" spinner. Short enough to not stall the pitch, long enough to feel like it's computing.
3. **Result** — Flag banner (red `sudden` / amber `drift` / green `normal`), 3–4 plain-English bullets with the actual numbers, CTA "Talk to your doctor… (not a diagnosis)", the trend chart, then "Check another value" / "Try a different story".
4. **Disclaimer footer** — Always visible, non-dismissible, amber-striped: *"DriftCheck is not a diagnosis…"*.

---

## 7. Production data model (`supabase/seed.sql`)

```sql
patients   (id, name, phone UNIQUE, email, created_at)
results    (id, patient_id→patients, biomarker, value, unit,
            measured_on, source='manual'|'lab_api', reported_at)
           + index (patient_id, biomarker, measured_on DESC)
check_events (id, patient_id, result_id→results, flag,
              z_score, slope, r_squared, total_change,
              personal_mean, personal_stddev, personal_min, personal_max,
              notified_sms, notified_email, created_at)
```

- **RLS:** every table is `enable row level security`; patients read only their own rows; doctors get a grant to *read* their patients' `check_events` summaries (no writes to results).
- **Insert flow:** `results` insert → trigger mirrors the scoring (or calls Edge Function) → writes `check_events` → non-`normal` rows enqueue `notify-on-flag`.
- **Scheduled:** `pg_cron` 08:00 IST → `daily-digest` Edge Function → Resend emails (patient weekly drift summary, doctor pre-visit digest).

---

## 8. Deployment runbook

### Frontend → Vercel
1. Push repo to GitHub.
2. `vercel` → import repo → framework auto-detected as Vite → default build (`npm run build`, output `dist`).
3. Done — SPA needs no rewrites (no client routing).

### Backend → Supabase
1. `supabase init` → `supabase link --project-ref <ref>`.
2. Apply schema: run `supabase/seed.sql` in the SQL editor (or `supabase db push`).
3. Enable extensions: `pg_cron` (and `pg_net` for the HTTP call).
4. Deploy the Edge Function:
   ```bash
   supabase functions deploy notify-on-flag
   supabase secrets set TWILIO_SID=... TWILIO_TOKEN=... \
     TWILIO_FROM=+1... RESEND_KEY=...
   supabase secrets set --env-name SUPABASE_SERVICE_ROLE_KEY \
     --project-ref <ref> <service_role_key>
   ```
5. Auth: enable email OTP provider (patients log in with email + OTP — no passwords to reset at a demo).

### Twilio
- Buy a number (or use sandbox for the demo build). **India note for scale:** transactional SMS uses registered DLT templates (`140dxxxxx`) — for the hackathon the sandbox number + plain message is fine as a proof.
- Pricing in India ≈ ₹0.22–0.36/msg at small volume — negligible at beta scale.

### Resend
- Create account → add domain (DKIM auto-config) → API key → `RESEND_KEY`.
- 12,000 free emails/month covers a beta of flagged digests.

---

## 9. Notifications pipeline (production detail)

```
new result
   ▼
run-drift-check (Edge Function)                     scoring, identical to browser
   ▼ check_events row written (RLS-policied audit)
flag = 'sudden' ──► notify-on-flag ──► Twilio SMS  patient 📱     (immediate)
flag = 'drift'  ──► notify-on-flag ──► Resend email doctor ✉️     (digest queue)
08:00 cron      ──► daily-digest     ──► Resend emails            (weekly patient,
                                                                   pre-visit doctor)
```

**Channel reasoning (judging answer):** SMS has the highest interrupt value and the lowest personality for non-urgent content — so it is *only* for acute `sudden` changes. Drift is a slow-burn signal that belongs in email digests and at the doctor visit, precisely where the naive "population range" approach fails today.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Live WiFi / network dies during demo | Scoring is 100% client-side; no backend dependency on stage |
| Presenter types a wrong digit | One-click demo stories + perturbation-tolerant thresholds + editable-but-preset fields |
| Judge: "why statistics, not ML?" | ML needs labeled data; a transparent z-score + r² is explainable, auditable, and clinically defensible for a trend *flag* (not a diagnosis) |
| Judge: "hospitals already do this" | This app targets the patient *between* visits — the gap is in the patient's hands, not the EHR |
| Judge: "is this a medical device?" | Positioned as wellness/monitoring with explicit non-diagnosis disclaimers; no diagnosis, no treatment decisions; CDSCO device rules target diagnostic claims |
| Data privacy (DPDP Act) | Only patient-consented numbers in scope for the prototype; production uses consent, phone OTP auth, RLS, and no data sale — noted but orthogonal to the 24h build |
| stddev = 0 divide-by-zero live | Guarded; tested |

---

## 11. 24-hour timeline

| Hours | Person A (Logic) | Person B (UI) | Person C (App Shell) |
|-------|------------------|---------------|----------------------|
| 0–1 | Lock 3 fixtures + reference ranges; verify numbers separate cleanly | Low-fi 4 screens in Figma | `npm create vite`, deps, screen state shell |
| 1–2 | Build z-score check; log outputs | Hand off wireframes; start components to match | Input screen (5 fields + validation + demo loader) |
| 2–4 | Build drift check; tune thresholds; log decisions | TrendChart (recharts bands + personal avg) | Wire `checkDrift()` into Result screen |
| 4–6 | Edge cases: zero stddev, NaN, empty; perturbation tests | Disclaimer banner + polish pass | Full flow E2E; try/catch hardening |
| 6–8 | Test suite green; hand off module | Color/accessibility pass | `npm run build` green; deploy to Vercel |
| 8–18 | Pair with C on live-typing rehearsals ×3 | Rehearse with presenter | Demo script: 3 stories, scripted narration |
| 18–24 | Defend thresholds + edge cases (Q&A drills) | Pitch deck polish | Final deploy + smoke test + backup demo recording |

---

## 12. Demo script (judge flow, ~90 seconds)

1. Screen opens → hemoglobin story is **already loaded** (zero clicks to start).
2. Tap "Check Hemoglobin" → spinner → **amber DRIFT banner**: "Gradual drift flagged — still inside the 'normal' range, but not what your own history looks like."
3. Narrate the chart: *"Every lab report compares 12.9 to the green band (12–16 g/dL). That band says 'fine'. DriftCheck compares it to this blue dashed line — your average — and the shaded blue band that YOUR history predicts. That's the gap every existing report misses."*
4. "Try a different story" → **TSH** → tap → green **"Matches your personal pattern"** — *"noise, handled correctly, no false alarm."*
5. → **Creatinine** → red **"Sudden change flagged"** — *"stable for months, then z ≈ 47 standard deviations off your own baseline — that's the acute flag that earns an SMS."*
6. End on the CTA + disclaimer: *"Every screen ends with 'talk to your doctor' — we flag changes, we never diagnose."*

---

## 13. What we are NOT claiming (for the judges)

- Not a diagnosis, not a medical device, not a replacement for care.
- Not "smarter than doctors" — it surfaces a trend **between** visits so the doctor start is pre-flagged.
- Not ML, not OCR, not lab-integrated yet — all deliberate 24-hour scope decisions, documented and defensible.