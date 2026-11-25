# VayuMitra (वायुमित्र) — Breath Companion for Indian Families

![CI](https://img.shields.io/badge/CI-format%20%7C%20lint%20%7C%20typecheck%20%7C%20test%20%7C%20build-10b981)
![Tests](https://img.shields.io/badge/Tests-51%2F51%20passed%20(8%20suites)-0ea5e9)
![Accessibility](https://img.shields.io/badge/WCAG%202.1-AA-6366f1)

VayuMitra turns **live Open-Meteo air-quality & weather telemetry** into personalized, explained household action plans for Indian families — combining an **India NAQI engine**, an interactive **24-hour forward Time Scrubber**, grounded **Ask VayuMitra Q&A**, privacy-preserving **Photo Check**, and transparent **Data Confidence** disclosures in English and Hindi (हिन्दी).

---

## Problem Statement

Most air-quality apps stop at raw AQI numbers (`"245 — Poor"`) without explaining what a specific family should actually do right now: whether kids can play after school, when the lowest-pollution window arrives today or tomorrow, whether N95 protection applies in Moderate air for seniors, where to place a purifier, or how to adapt daily commutes. VayuMitra bridges that gap with zero invented data and deterministic offline resilience.

---

## Core Features

1. **India CPCB NAQI Engine (`src/lib/naqi/naqi.ts`)**: Linearly interpolates official PM2.5 (`0–380 µg/m³`) and PM10 (`0–510 µg/m³`) breakpoints, selects the dominant pollutant, computes rolling 24h or current readings, and scans strictly forward (`Today` / `Tomorrow`) for the cleanest and worst 3-hour windows.
2. **Dynamic Weather & Haze Hero + 24h Time Scrubber**: Animated NAQI ring gauge, city-aware 3-layer SVG Indian skylines (Delhi, Mumbai, Lucknow, Kolkata, general), lazy-loaded atmospheric `<canvas>` particle haze/rain/stars, and an accessible 24-hour scrub slider (`[ / ]` or drag) updating the Hero live.
3. **Personalized Action Plan + "Today's Plan" Tracker**: Collapsible household profile (`CitySearch`, sensitive groups, commute lifestyle, HEPA purifier toggle, plus **"Try a sample"** menu with 8 Indian household presets), checkable action items with expandable `"Why this?"` reasoning, and 1080×1350 PNG **Share Air Card** export.
4. **Ask VayuMitra (`POST /api/ask`)**: Natural-language household Q&A chips and custom input (up to 300 chars) returning `{ verdict: yes|no|caution, answer, why, bestTime, dataUsed }` grounded strictly in live Open-Meteo metrics.
5. **Photo Check (`POST /api/photo-check`)**: Upload or capture a room/sky photo (`jpeg`/`png`/`webp`, `<= 4 MB`). All EXIF/GPS metadata is stripped locally on an offscreen `<canvas>`, magic bytes are verified server-side, and Gemini Vision returns visual purifier placement, ventilation tips, and confidence (`low`/`medium`/`high`).
6. **Data Confidence ("How reliable is this?")**: Explains Open-Meteo's CAMS/ECMWF model estimate vs physical CPCB stations, rolling/current NAQI basis, IST update timestamp, and direct source links.

---

## Architecture & Data Flow

```text
+-------------------------------------------------------------------------+
| React 19 + TypeScript + Tailwind Browser Client                         |
|                                                                         |
|  CitySearch / Sample  --->  openMeteo.ts (10m cache + in-flight dedupe) |
|                                  |                                      |
|                                  v                                      |
|                       naqi.ts (India NAQI + forward windows)            |
|                                  |                                      |
|         +------------------------+-------------------------+            |
|         v                        v                         v            |
|  useAdvice (/api/advice)   AskVayuMitra (/api/ask)   PhotoCheck         |
|  10m session/mem cache     live profile + forecast   local EXIF strip   |
|  + offline last-known snapshot fallback & React ErrorBoundary           |
+-------------------------------------------------------------------------+
                                   | HTTPS / JSON (.strict() Zod schemas)
                                   v
+-------------------------------------------------------------------------+
| Express Backend (server.ts)                                             |
|  * Fail-fast GEMINI_API_KEY startup guard + redacted JSON logging       |
|  * Per-request nonce CSP, HSTS, frame-ancestors 'none', origin CORS     |
|  * Per-IP, per-route sliding-window rate limits (429 + Retry-After)     |
|  * gzip compression, immutable /assets cache, 10m cache + in-flight map |
|  * Google GenAI SDK (gemini-4-hydrogen -> gemini-3.1-flash-lite)        |
|  * <untrusted_input> prompt-injection delimiters + offline fallback     |
+-------------------------------------------------------------------------+
```

---

## Prompt Design & JSON Schemas

See [`docs/PROMPTS.md`](docs/PROMPTS.md) for the `<untrusted_input>` prompt-injection delimiters, exact system instructions, safety guardrails (such as banning `"clean air"` whenever NAQI ≠ `Good`, banning invented readings/diagnoses, and enforcing stated `approx.` CO₂ assumptions), and `.strict()` JSON schemas used by `/api/advice`, `/api/ask`, and `/api/photo-check`.

---

## Security, Accessibility & Performance

- **Security** ([`SECURITY.md`](SECURITY.md)): Fail-fast server-only `GEMINI_API_KEY`, per-request nonce CSP (no `'unsafe-inline'`/`'unsafe-eval'`), `frame-ancestors 'none'`, HSTS, origin-locked CORS (`403` on foreign origins), `.strict()` Zod validation with India coordinate bounds, JPEG/PNG/WebP magic-byte verification, `<untrusted_input>` prompt isolation, redacted structured logging, and zero `npm audit` vulnerabilities.
- **Accessibility** ([`ACCESSIBILITY.md`](ACCESSIBILITY.md)): Skip-to-content link, single `<h1>` + logical heading order, dynamic `<html lang="en|hi">`, `aria-describedby` alert bindings, `aria-live` announcements, dialog focus traps, 44px minimum touch targets, WCAG AA scrim contrast + `prefers-contrast: more`, `prefers-reduced-motion` support, and `320px` / 200% zoom resilience verified with `jest-axe` and Playwright.
- **Performance (`vite build`)**:
  - **Entry & Vendor Chunks**: `index.html` (`2.13 kB` / `0.79 kB` gz), CSS (`46.97 kB` / `9.07 kB` gz), `index` app bundle (`171.75 kB` / `43.47 kB` gz), `react-vendor` (`404.71 kB` / `123.12 kB` gz), `motion-vendor` (`149.52 kB` / `48.30 kB` gz), `ui-vendor` (`93.50 kB` / `27.71 kB` gz).
  - **Lazy-Loaded Chunks**: `PhotoCheckCard` (`16.60 kB` / `5.26 kB` gz), `AskVayuMitra` (`11.90 kB` / `3.84 kB` gz), `HourlyDetailsSheet` (`9.28 kB` / `2.33 kB` gz), `shareCard` (`5.64 kB` / `2.33 kB` gz), `ShortcutsModal` (`3.90 kB` / `1.58 kB` gz), `HeroParticleCanvas` (`3.78 kB` / `1.69 kB` gz).
  - **Caching & Runtime**: 10-minute TTL caches and concurrent in-flight deduplication in both `src/lib/api/openMeteo.ts` and `server.ts`, `compression` middleware + immutable `/assets/*` headers, `hardwareConcurrency`-capped `<canvas>` particles that pause on hidden tabs, and font preloading with `display=swap`.

---

## Verification & Coverage Summary

Latest `npm run test:coverage` output (**8 test files, 51 tests passed**):

| Module / Area | Stmts | Branch | Funcs | Lines | Scope |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `src/lib` (config & errors) | 96.29% | 83.33% | 100.0% | 96.29% | Centralized config, typed `AppError` hierarchy |
| `src/lib/theme` | 100.0% | 100.0% | 100.0% | 100.0% | All 6 NAQI themes, day/night & weather selection |
| `src/lib/share` | 95.62% | 65.90% | 91.66% | 96.11% | Share Air Card 1080×1350 spec & canvas export |
| `src/lib/shared` | 95.23% | 85.71% | 100.0% | 94.44% | Sanitizers, `<untrusted_input>` wrapper, disclaimers |
| `src/lib/api` | 88.99% | 77.01% | 82.14% | 90.40% | Open-Meteo fetch, retries, 10m cache & offline snapshots |
| `src/lib/advice` | 88.42% | 62.75% | 100.0% | 89.53% | `.strict()` Zod schemas, fallbacks, plan tracker |
| `src/lib/naqi` | 87.76% | 67.37% | 96.29% | 90.05% | Breakpoints, forward windows, scrubber, mask rules |
| `src/lib/vision` | 86.86% | 63.63% | 90.47% | 89.36% | Local EXIF strip, magic-byte check, vision fallback |
| `src/lib/profiles` | 82.60% | 76.00% | 100.0% | 81.81% | Saved household profile validation & 8 Indian presets |
| `src/lib/ask` | 80.70% | 30.30% | 100.0% | 81.48% | `.strict()` Q&A Zod schemas & grounded fallback |
| `server.ts` | 84.83% | 67.50% | 85.36% | 86.13% | Fail-fast boot, CSP, CORS, rate limit, failover, caching |
| **All Covered Files** | **69.03%** | **54.44%** | **66.05%** | **71.51%** | Combined suite including React UI & `jest-axe` tests |

---

## Sample Household Profiles (`/samples`)

| Sample File | City | Household Profile | Purifier | Language |
| :--- | :--- | :--- | :---: | :---: |
| `samples/delhi-kids.json` | Delhi | Kids · Metro commute | Yes | EN |
| `samples/lucknow-senior.json` | Lucknow | Seniors · Work from home | No | HI |
| `samples/patna-commuter.json` | Patna | Outdoor worker · Two-wheeler | No | EN |
| `samples/mumbai-asthma.json` | Mumbai | Asthma / Heart · Bus commute | Yes | EN |
| `samples/bengaluru-wfh.json` | Bengaluru | General · Work from home | No | EN |
| `samples/kolkata-outdoor.json` | Kolkata | Seniors + Outdoor worker · Bus commute | No | EN |
| `samples/jaipur-runner.json` | Jaipur | General · Daily runner / walker | No | EN |
| `samples/chennai-pregnant.json` | Chennai | Pregnancy · Car commute | Yes | EN |

---

## How to Run & Test

```bash
# 1. Install dependencies
npm install

# 2. Configure required server environment variable (server fails fast if missing)
cp .env.example .env
# Set GEMINI_API_KEY in .env

# 3. Start full-stack dev server on http://localhost:3000
npm run dev

# 4. Run quality gates (CI pipeline in .github/workflows/ci.yml)
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

---

## Known Limitations

- **Model Estimates vs Ground Stations**: Open-Meteo derives PM2.5/PM10 from regional CAMS/ECMWF atmospheric assimilation grids rather than physical street-level CPCB monitors; localized traffic, construction, or crop burning can differ.
- **No Medical Advice**: Recommendations follow general public-health exposure practices and do not constitute clinical diagnosis or emergency guidance.
- **Visual Photo Check**: Photo Check identifies visible layout, ventilation, and haze cues only; camera images cannot measure PM2.5 or AQI concentrations.
