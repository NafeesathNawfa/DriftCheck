# DriftCheck — Compare your labs to you, not the crowd

DriftCheck compares a new blood test result to a patient's *own* recent history — not just the fixed population "normal" range every lab prints — and flags a slow drift that never leaves the normal band, or a sudden spike, before the next scheduled appointment.

> **This is a wellness monitoring tool. It is not a diagnosis.**

---

## Quick start

```bash
npm install
npm run dev        # local Vite dev server
npm run build      # production build → dist/
npm test           # vitest — core logic tests
```

Open the local URL printed by `vite` — the hemoglobin demo story loads automatically.

---

## How the scoring works

`src/lib/checkDrift.ts` is a zero-dependency TypeScript module. It runs in the browser and takes two arguments: `past: number[]` (4 prior values) and `newValue: number`. It returns a flag plus the full diagnostic details.

Two checks run in sequence:

| Check | Method | What it catches |
|-------|--------|-----------------|
| **Sudden change** | z-score of new value vs. the patient's own mean/stddev (threshold: 2.5σ) | Acute jumps — e.g. creatinine stable at ~0.9 for months, then 1.8 |
| **Gradual drift** | least-squares slope + total absolute change ≥ 1.0 unit + r² ≥ 0.6 (noise filter) | Slow monotonic movement — e.g. hemoglobin drifting from 14.5 → 12.9 across 5 checks |

Sudden always takes priority if both would fire. The module is tested against three realistic demo fixtures in `src/lib/checkDrift.test.ts`.

---

## Project structure

```
├── PLAN.md                          ← full implementation & deployment plan
├── src/
│   ├── lib/
│   │   ├── checkDrift.ts            ← core scoring module (zero deps, Person A)
│   │   ├── checkDrift.test.ts       ← vitest fixture tests
│   │   └── demoStories.ts           ← 3 demo fixtures (hemoglobin, TSH, creatinine)
│   ├── data/
│   │   └── biomarkers.ts            ← metadata: names, units, pop ranges, concern direction
│   ├── components/
│   │   ├── InputScreen.tsx          ← 5-field form, biomarker picker, "load demo" one-click
│   │   ├── CheckScreen.tsx          ← brief "analyzing" state
│   │   ├── ResultScreen.tsx         ← flag banner, explanation bullets, CTA
│   │   ├── TrendChart.tsx           ← recharts LineChart with population + personal bands
│   │   └── DisclaimerBanner.tsx     ← sticky footer, non-dismissible
│   ├── App.tsx                      ← screen state, wires logic → UI
│   ├── main.tsx
│   └── index.css
├── supabase/
│   ├── seed.sql                     ← production Postgres schema
│   └── functions/
│       └── notify-on-flag/index.ts  ← Deno Edge Function (Twilio + Resend)
└── vite.config.ts
```

---

## Deployment

See [PLAN.md](./PLAN.md) for the full architecture, tech stack rationale, and step-by-step deployment guide.

| Component | Destination | Why |
|-----------|-------------|-----|
| Frontend SPA | **Vercel** | Git-push deploy, global edge, free tier covers beta |
| Database + Auth + Edge Functions | **Supabase** | Postgres + pg_cron + Deno Edge Functions — one product |
| SMS alerts | **Twilio** | Works on feature phones in India; per-SMS billing, no infra |
| Email digests | **Resend** | Simple REST API; DKIM out-of-box; 12k free emails/mo |

---

## Important disclaimers

- DriftCheck is **not a diagnostic device** and makes **no medical claims**.
- Every result screen includes a persistent, non-dismissible disclaimer.
- The comparison is a **statistical deviation flag**, not a clinical interpretation.
- All flags end with **"Talk to your doctor"** — never "this is normal" or "this is concerning".
- The hackathon demo runs entirely **client-side** with zero network dependencies.

---

## License

Internal hackathon project — not for production use or medical claims.
