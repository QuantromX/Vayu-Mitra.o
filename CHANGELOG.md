# Changelog

## Hardening & Production Polish

### Security
- Enforced fail-fast server startup check (`requireGeminiApiKey`) rejecting missing or placeholder `GEMINI_API_KEY` values.
- Upgraded all request and Gemini response Zod schemas to `.strict()`, added India geographic coordinate bounds (`latitude 6..37.6`, `longitude 68..97.5`), enforced a 300-character max on `AskVayuMitra` questions, and validated real binary JPEG/PNG/WebP magic bytes on uploaded photos.
- Replaced static permissive CSP with per-request cryptographic nonce CSP (`'nonce-...'` on `<script>`, `<style>`, and `<meta property="csp-nonce">`), disabled `'unsafe-inline'` and `'unsafe-eval'`, set `frame-ancestors 'none'`, `Strict-Transport-Security`, and locked CORS to explicit allowed/same-host origins (`403` otherwise).
- Added sliding-window per-route IP rate limiting (`20/12/6 req/min` + `Retry-After`), `AbortController` upstream/client timeouts, `<untrusted_input>` prompt-injection delimiters, and structured JSON logging with automatic sensitive-field redaction.
- Pinned exact dependencies in `package.json`, removed unused `autoprefixer`/`oxlint`/conflicting `esbuild`, regenerated `package-lock.json`, and verified 0 vulnerabilities via `npm audit`.

### Code Quality & Efficiency
- Enabled `noUncheckedIndexedAccess` and strict TypeScript flags with zero `any` types and zero `console.*` calls in production code.
- Standardized typed constants in `src/lib/config.ts`, domain helpers in `src/lib/shared/domain.ts`, and typed `AppError` subclasses in `src/lib/errors.ts`.
- Added gzip/brotli `compression`, immutable caching on `/assets/*`, Vite vendor chunk splitting, explicit `width`/`height` attributes on `<svg>` and `<img>`, `hardwareConcurrency`-aware canvas particle limits, and font `preconnect`/`preload` with `display=swap`.

### Accessibility & Reliability
- Synchronized `<html lang="en|hi">` dynamically on language toggle, added `aria-describedby` error links, added `prefers-contrast: more` overrides, and verified `320px` and `200%` zoom responsiveness with 0 overflow.
- Added React `ErrorBoundary`, Open-Meteo `AbortController` retries + exponential backoff, offline fallback rendering from the last saved city snapshot with an `"Offline"` badge, and visible non-medical disclaimer copy.
- Expanded automated unit, API, React Testing Library, and `jest-axe` test suites alongside Prettier + ESLint (`--max-warnings 0`) CI gates.
