# VayuMitra — Security & Verification Walkthrough

## Security Summary

VayuMitra's security posture was hardened end-to-end across server startup, request parsing, Gemini prompt boundaries, HTTP headers, client state, and dependencies:

1. **Server-Side Key Isolation & Fail-Fast Boot (`server.ts`)**: `GEMINI_API_KEY` is read solely from `process.env` via `requireGeminiApiKey()` and never exposed to Vite client builds. Startup fails immediately with `ConfigError` if the key is absent or still equals `'MY_GEMINI_API_KEY'`.
2. **Strict Input, Bounds & Binary Validation (`src/lib/advice/schema.ts`, `src/lib/ask/schema.ts`, `src/lib/vision/schema.ts`)**:
   - All request schemas use `.strict()` to reject unexpected fields.
   - Coordinates validate strictly inside India bounds (`latitude` 6–37.6, `longitude` 68–97.5).
   - `AskVayuMitra` questions enforce a 2–300 character limit; `cityName` enforces `CITY_NAME_REGEX` and strips control characters and `<`/`>`.
   - `/api/photo-check` enforces `<= 4 MB` decoded size, strict MIME allowlist (`image/jpeg`, `image/png`, `image/webp`), local offscreen-canvas EXIF stripping on the client, and binary magic-byte header verification on the server.
3. **Nonce CSP, Security Headers & Origin-Locked CORS (`server.ts`, `index.html`)**:
   - Every response receives a fresh 16-byte random base64 CSP nonce injected into `Content-Security-Policy` (`script-src 'self' 'nonce-...'`, `style-src 'self' 'nonce-...' https://fonts.googleapis.com`) and HTML `<script>`/`<style>`/`<meta property="csp-nonce">` tags—with zero `'unsafe-inline'` or `'unsafe-eval'`.
   - Enforces `frame-ancestors 'none'`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
   - Foreign CORS `Origin` headers on `/api/*` are logged (redacted) and rejected with HTTP `403`.
4. **Prompt-Injection & XSS Hardening (`server.ts`, `src/lib/shared/domain.ts`)**:
   - Untrusted strings are wrapped inside `<untrusted_input name="...">...</untrusted_input>` tags, system instructions explicitly forbid following embedded instructions, outputs are parsed against strict Gemini `responseSchema` + `.strict()` Zod schemas, and React renders text safely without `dangerouslySetInnerHTML`.
5. **Rate Limiting, Timeouts & Redacted Logs**:
   - Per-IP sliding-window limits (`20/min` advice, `12/min` ask, `6/min` photo-check) return `429` with `Retry-After`.
   - `AbortController` enforces bounded timeouts across server Gemini calls and client Open-Meteo/`/api/*` requests.
   - `logStructured` outputs JSON logs with automatic `[REDACTED]` masking for keys, tokens, secrets, passwords, auth headers, prompts, questions, and base64 images.

## PoC Verification

All checks below execute deterministically in automated CI and local verification without calling live external APIs:

1. **Missing Key Fail-Fast (`apiRoutes.test.ts`)**: `requireGeminiApiKey({})` and `createExpressApp()` without `GEMINI_API_KEY` throw `ConfigError`.
2. **Magic-Byte Spoofing & Unknown Fields Rejection (`apiRoutes.test.ts`)**: Sending `'A'.repeat(64)` labeled `image/jpeg` or an unknown JSON key to `/api/advice` returns HTTP `400`; bodies exceeding `64kb` return HTTP `413`; malformed JSON returns generic HTTP `400` with `correlationId` and zero stack traces.
3. **Nonce CSP & Foreign CORS Enforcement (`apiRoutes.test.ts`)**: `GET /api/health` confirms unique `'nonce-...'` without `'unsafe-inline'`/`'unsafe-eval'`, `frame-ancestors 'none'`, and `403` on `Origin: https://evil.example`. `GET /` injects matching nonces into HTML tags.
4. **Rate Limiting & Quota Failover (`apiRoutes.test.ts`)**: Exceeding per-route IP quotas returns HTTP `429` with `Retry-After`; `429 RESOURCE_EXHAUSTED` from `gemini-4-hydrogen` activates cooldown and seamlessly fails over to `gemini-3.1-flash-lite`.
5. **Offline Snapshot Recovery, ErrorBoundary & Accessibility (`uiComponents.test.tsx`)**: Open-Meteo `503` triggers fallback to the last saved city snapshot with an `"Offline"` badge and live Retry recovery; `<html lang>` switches `"en"` <-> `"hi"`; `jest-axe` reports `0` WCAG violations across all cards and modals.
6. **Live Browser Check (`playwright-cli`)**: Verified rendered UI at `1280x900`, `640x480` (200% zoom sim), and `320x700` narrow mobile with 0 console/CSP errors and 0px horizontal overflow.
