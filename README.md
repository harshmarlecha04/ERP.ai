# ERP.ai

ERP.ai Manufacturing ERP System — Vite + React + TypeScript + Tailwind, with
Supabase (database, auth, edge functions) and Claude (Anthropic) powering all
AI features.

## AI features (Claude)

| Edge function | What it does |
|---|---|
| `erp-assistant` | Streaming chat assistant over live ERP data |
| `nl-reports` | Natural language → report query plan |
| `ai-operational-insights` | Daily operational summary + insights |
| `parse-coa-test-results` | COA image/PDF → structured JSON (vision) |
| `ai-scan-po` | Purchase order PDF → structured JSON |

All model calls go through one shared client: `supabase/functions/_shared/anthropic.ts`.
To change models, edit the `MODELS` object there.

## Getting started

```sh
npm install
cp .env.example .env   # fill in your Supabase URL + publishable key
npm run dev            # http://localhost:8080
```

## Deploying the AI backend

```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # from console.anthropic.com
supabase functions deploy erp-assistant
supabase functions deploy nl-reports
supabase functions deploy ai-operational-insights
supabase functions deploy parse-coa-test-results
supabase functions deploy ai-scan-po
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — ESLint
