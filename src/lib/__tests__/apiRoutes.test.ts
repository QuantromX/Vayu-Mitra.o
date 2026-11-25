import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createExpressApp,
  injectNonceIntoHtml,
  requireGeminiApiKey,
  type GeminiLikeClient,
} from '../../../server.ts';
import { ConfigError } from '../errors.ts';

async function startTestServer(aiClient: GeminiLikeClient | null, rateLimitMax = 10) {
  const app = await createExpressApp({
    aiClient,
    attachVite: false,
    rateLimitMax,
    isProd: true,
  });

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl };
}

const VALID_JPEG_B64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]).toString('base64');

const VALID_ADVICE_BODY = {
  cityName: 'Delhi',
  latitude: 28.65,
  longitude: 77.23,
  aqi: 245,
  category: 'Poor',
  dominantPollutant: 'PM2.5',
  pm25: 102,
  pm10: 165,
  basis: 'rolling_24h',
  temperatureC: 24,
  humidityPct: 58,
  windSpeedKmh: 7,
  cleanestWindow: {
    startHour: '14:00',
    endHour: '17:00',
    dayLabel: 'Today',
    endDayLabel: 'Today',
    avgNaqi: 180,
    avgPm25: 84,
  },
  worstWindow: {
    startHour: '21:00',
    endHour: '00:00',
    dayLabel: 'Today',
    endDayLabel: 'Today',
    avgNaqi: 305,
    avgPm25: 130,
  },
  household: ['kids'],
  lifestyle: 'commute_metro',
  hasPurifier: true,
  language: 'en',
};

const VALID_ASK_BODY = {
  question: 'Can kids play cricket outside after 4 PM?',
  cityName: 'Delhi',
  latitude: 28.65,
  longitude: 77.23,
  aqi: 245,
  category: 'Poor',
  dominantPollutant: 'PM2.5',
  pm25: 102,
  pm10: 165,
  temperatureC: 24,
  humidityPct: 58,
  windSpeedKmh: 7,
  cleanestWindow: {
    startHour: '14:00',
    endHour: '17:00',
    dayLabel: 'Today',
    avgNaqi: 180,
    avgPm25: 84,
  },
  worstWindow: null,
  forwardHourly: [],
  household: ['kids'],
  lifestyle: 'commute_metro',
  hasPurifier: true,
  language: 'en',
};

const VALID_PHOTO_BODY = {
  mimeType: 'image/jpeg',
  imageBase64: VALID_JPEG_B64,
  sceneHint: 'room',
  aqi: 245,
  category: 'Poor',
  hasPurifier: true,
  language: 'en',
};

describe('Express /api Routes, Security Headers & Rate Limiting', () => {
  let okServer: http.Server;
  let okBaseUrl: string;

  beforeAll(async () => {
    const mockAi: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async ({ config }) => {
          const schema = (config as { responseSchema?: { required?: string[] } })
            ?.responseSchema;
          const required = schema?.required ?? [];
          if (required.includes('verdict') && required.includes('outdoor')) {
            return {
              text: JSON.stringify({
                verdict: {
                  level: 'Poor',
                  headline: 'Keep outdoor play brief; prefer Today 14:00–17:00',
                  summary: 'PM2.5 is 102 µg/m³ right now across Delhi.',
                },
                outdoor: [
                  {
                    action: 'Limit outdoor play to Today 14:00–17:00.',
                    why: 'Afternoon mixing yields the lowest NAQI ~180 ahead.',
                    timeWindow: 'Today 14:00–17:00',
                  },
                ],
                indoor: [
                  {
                    action:
                      'Run HEPA purifier on high during Today 21:00–00:00 and damp-mop.',
                    why: 'Peak haze raises indoor PM2.5 infiltration.',
                  },
                ],
                routine: [
                  {
                    action: 'Take the metro and batch errands.',
                    why: 'Cuts roadside exposure and tailpipe emissions.',
                    co2Benefit: 'Approx. 1.4 kg CO₂ saved (assumes 10 km car vs metro)',
                  },
                ],
                mask: {
                  recommended: true,
                  type: 'N95 / FFP2',
                  why: 'Poor category recommends N95 outdoors for everyone.',
                },
                forWhom: [
                  {
                    group: 'Children',
                    advice: 'Keep intense evening sports indoors today.',
                  },
                ],
              }),
            };
          }

          if (required.includes('dataUsed')) {
            return {
              text: JSON.stringify({
                answer: 'No — keep intense cricket indoors after 4 PM today.',
                verdict: 'no',
                why: 'NAQI is 245 (Poor) with PM2.5 at 102 µg/m³.',
                bestTime: 'Today 14:00–17:00',
                dataUsed: ['NAQI 245 (Poor)', 'PM2.5 102 µg/m³'],
              }),
            };
          }

          return {
            text: JSON.stringify({
              observations: ['Balcony sliding door gap lets roadside dust enter.'],
              purifierPlacement:
                'Place the HEPA unit 1.5 m from the bed with clear vents.',
              ventilationTip: 'Keep balcony doors shut until Today 14:00–17:00.',
              confidence: 'medium',
              disclaimer: 'Visual advisory estimate only, not a PM2.5 measurement.',
            }),
          };
        }),
      },
    };

    const started = await startTestServer(mockAi, 10);
    okServer = started.server;
    okBaseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => okServer.close(() => resolve()));
  });

  it('fails fast with ConfigError when GEMINI_API_KEY is missing or placeholder', async () => {
    expect(() => requireGeminiApiKey({})).toThrow(ConfigError);
    expect(() => requireGeminiApiKey({ GEMINI_API_KEY: 'MY_GEMINI_API_KEY' })).toThrow(
      /Missing GEMINI_API_KEY/
    );
    expect(requireGeminiApiKey({ GEMINI_API_KEY: 'real-server-key' })).toBe(
      'real-server-key'
    );

    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await expect(createExpressApp({ attachVite: false, isProd: true })).rejects.toThrow(
        /Missing GEMINI_API_KEY/
      );
    } finally {
      if (prevKey !== undefined) {
        process.env.GEMINI_API_KEY = prevKey;
      }
    }
  });

  it('sets strict security headers (nonce CSP, HSTS, frame-ancestors none, Permissions-Policy) and enforces CORS', async () => {
    const res = await fetch(`${okBaseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(res.headers.get('permissions-policy')).toBe(
      'camera=(self), microphone=(), geolocation=()'
    );
    expect(res.headers.get('x-request-id')).toBeTruthy();

    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("'nonce-");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");

    // Foreign CORS origin is rejected with 403
    const evilCors = await fetch(`${okBaseUrl}/api/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    expect(evilCors.status).toBe(403);

    // Allowed origin preflight returns 204
    const okPreflight = await fetch(`${okBaseUrl}/api/advice`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(okPreflight.status).toBe(204);
    expect(okPreflight.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:3000'
    );

    const injected = injectNonceIntoHtml(
      '<meta property="csp-nonce" nonce="__CSP_NONCE__" /><script type="module"></script><style></style>',
      'abc123'
    );
    expect(injected).toContain('nonce="abc123"');
    expect(injected).toContain('<script nonce="abc123"');
    expect(injected).toContain('<style nonce="abc123"');
  });

  it('handles /api/advice, /api/ask, /api/photo-check success & rejects spoofed magic bytes, unknown fields, malformed JSON, and oversized bodies', async () => {
    const advOk = await fetch(`${okBaseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ADVICE_BODY),
    });
    expect(advOk.status).toBe(200);
    expect(((await advOk.json()) as { source: string }).source).toBe('gemini');

    // Rejects unknown fields via .strict()
    const advExtra = await fetch(`${okBaseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_ADVICE_BODY, unknownField: 'bad' }),
    });
    expect(advExtra.status).toBe(400);

    // Malformed JSON returns clean 400 without stack trace
    const malformed = await fetch(`${okBaseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });
    expect(malformed.status).toBe(400);
    const malformedJson = (await malformed.json()) as {
      error: string;
      correlationId: string;
    };
    expect(malformedJson.error).toBe('Malformed JSON body.');
    expect(malformedJson.correlationId).toBeTruthy();

    // Oversized body > 64kb on /api/advice returns 413
    const oversizedAdvice = await fetch(`${okBaseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_ADVICE_BODY, padding: 'x'.repeat(75_000) }),
    });
    expect(oversizedAdvice.status).toBe(413);

    const askOk = await fetch(`${okBaseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ASK_BODY),
    });
    expect(askOk.status).toBe(200);
    const askJson = (await askOk.json()) as { source: string; verdict: string };
    expect(askJson.source).toBe('gemini');
    expect(askJson.verdict).toBe('no');

    const askBad = await fetch(`${okBaseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_ASK_BODY, question: 'x' }),
    });
    expect(askBad.status).toBe(400);

    const photoOk = await fetch(`${okBaseUrl}/api/photo-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_PHOTO_BODY),
    });
    expect(photoOk.status).toBe(200);
    const photoJson = (await photoOk.json()) as {
      source: string;
      confidence: string;
    };
    expect(photoJson.source).toBe('gemini');
    expect(photoJson.confidence).toBe('medium');

    // Rejects spoofed JPEG payload whose magic bytes do not match JPEG header
    const photoSpoof = await fetch(`${okBaseUrl}/api/photo-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_PHOTO_BODY, imageBase64: 'A'.repeat(64) }),
    });
    expect(photoSpoof.status).toBe(400);

    const photoBad = await fetch(`${okBaseUrl}/api/photo-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_PHOTO_BODY, mimeType: 'image/gif' }),
    });
    expect(photoBad.status).toBe(400);
  });

  it('retries once when Gemini returns malformed JSON and recovers cleanly', async () => {
    let calls = 0;
    const flakyJsonAi: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async () => {
          calls += 1;
          if (calls === 1) {
            return { text: 'not valid json {{{' };
          }
          return {
            text: JSON.stringify({
              answer: 'Caution — wait until Today 14:00–17:00 for errands.',
              verdict: 'caution',
              why: 'PM2.5 is 102 µg/m³ right now in Delhi.',
              bestTime: 'Today 14:00–17:00',
              dataUsed: ['NAQI 245 (Poor)', 'PM2.5 102 µg/m³'],
            }),
          };
        }),
      },
    };
    const { server, baseUrl } = await startTestServer(flakyJsonAi, 5);
    try {
      const res = await fetch(`${baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ASK_BODY),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { source: string; verdict: string };
      expect(body.source).toBe('gemini');
      expect(body.verdict).toBe('caution');
      expect(calls).toBe(2);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('falls back cleanly on Gemini upstream failure and enforces 429 per-route rate limit with Retry-After', async () => {
    const failingAi: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async () => {
          throw new Error('Upstream 503 unavailable');
        }),
      },
    };
    const { server, baseUrl } = await startTestServer(failingAi, 2);
    try {
      // Advice fallback (1st & 2nd pass) + rate limit hit (3rd)
      const a1 = await fetch(`${baseUrl}/api/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ADVICE_BODY),
      });
      expect(a1.status).toBe(200);
      expect(((await a1.json()) as { source: string }).source).toBe('fallback');

      const a2 = await fetch(`${baseUrl}/api/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_ADVICE_BODY, cityName: 'Lucknow' }),
      });
      expect(a2.status).toBe(200);

      const a3 = await fetch(`${baseUrl}/api/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_ADVICE_BODY, cityName: 'Patna' }),
      });
      expect(a3.status).toBe(429);
      expect(a3.headers.get('retry-after')).toBeTruthy();

      // Ask fallback + rate limit hit
      const q1 = await fetch(`${baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ASK_BODY),
      });
      expect(q1.status).toBe(200);
      expect(((await q1.json()) as { source: string }).source).toBe('fallback');

      await fetch(`${baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...VALID_ASK_BODY,
          question: 'Should I wear N95 today?',
        }),
      });
      const q3 = await fetch(`${baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ASK_BODY),
      });
      expect(q3.status).toBe(429);
      expect(q3.headers.get('retry-after')).toBeTruthy();

      // Photo check fallback + rate limit hit
      const p1 = await fetch(`${baseUrl}/api/photo-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PHOTO_BODY),
      });
      expect(p1.status).toBe(200);
      expect(((await p1.json()) as { source: string }).source).toBe('fallback');

      await fetch(`${baseUrl}/api/photo-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PHOTO_BODY),
      });
      const p3 = await fetch(`${baseUrl}/api/photo-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PHOTO_BODY),
      });
      expect(p3.status).toBe(429);
      expect(p3.headers.get('retry-after')).toBeTruthy();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('cools down quota-exhausted models, fails over to secondary model, and falls back on 401 auth errors', async () => {
    const modelsCalled: string[] = [];
    const quotaThenOkAi: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async ({ model }) => {
          modelsCalled.push(String(model));
          if (model === 'gemini-4-hydrogen') {
            throw new Error(
              '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","retryDelay":"120s"}}'
            );
          }
          return {
            text: JSON.stringify({
              answer: 'Yes — brief evening walk is okay using the secondary model.',
              verdict: 'caution',
              why: 'PM2.5 is 102 µg/m³ right now across Delhi.',
              bestTime: 'Today 14:00–17:00',
              dataUsed: ['NAQI 245 (Poor)'],
            }),
          };
        }),
      },
    };

    const first = await startTestServer(quotaThenOkAi, 10);
    try {
      const r1 = await fetch(`${first.baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ASK_BODY),
      });
      expect(r1.status).toBe(200);
      expect(((await r1.json()) as { source: string }).source).toBe('gemini');
      expect(modelsCalled).toEqual(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);

      // Primary model stays cooled down on next distinct request
      const r2 = await fetch(`${first.baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...VALID_ASK_BODY,
          question: 'Can seniors walk tomorrow morning?',
        }),
      });
      expect(r2.status).toBe(200);
      expect(modelsCalled[2]).toBe('gemini-3.1-flash-lite');
    } finally {
      await new Promise<void>((resolve) => first.server.close(() => resolve()));
    }

    const authFailAi: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async () => {
          const err = new Error('API_KEY_INVALID') as Error & { status?: number };
          err.status = 401;
          throw err;
        }),
      },
    };
    const second = await startTestServer(authFailAi, 10);
    try {
      const rAuth = await fetch(`${second.baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ASK_BODY),
      });
      expect(rAuth.status).toBe(200);
      expect(((await rAuth.json()) as { source: string }).source).toBe('fallback');
    } finally {
      await new Promise<void>((resolve) => second.server.close(() => resolve()));
    }
  });

  it('deduplicates concurrent identical requests and serves cached advice & ask responses', async () => {
    let generateCalls = 0;
    const slowAi: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async ({ config }) => {
          generateCalls += 1;
          await new Promise((r) => setTimeout(r, 25));
          const required =
            (config as { responseSchema?: { required?: string[] } })?.responseSchema
              ?.required ?? [];
          if (required.includes('verdict') && required.includes('outdoor')) {
            return {
              text: JSON.stringify({
                verdict: {
                  level: 'Poor',
                  headline: 'Keep outdoor play brief; prefer Today 14:00–17:00',
                  summary: 'PM2.5 is 102 µg/m³ right now across Delhi.',
                },
                outdoor: [
                  {
                    action: 'Limit outdoor play to Today 14:00–17:00.',
                    why: 'Afternoon mixing yields lower NAQI ahead.',
                  },
                ],
                indoor: [
                  {
                    action: 'Run HEPA purifier on high during peak evening haze.',
                    why: 'Peak haze raises indoor PM2.5.',
                  },
                ],
                routine: [
                  {
                    action: 'Use the metro and batch errands.',
                    why: 'Cuts roadside exposure.',
                  },
                ],
                mask: {
                  recommended: true,
                  type: 'N95 / FFP2',
                  why: 'Poor category recommends N95 outdoors.',
                },
                forWhom: [{ group: 'Children', advice: 'Keep evening sports indoors.' }],
              }),
            };
          }
          return {
            text: JSON.stringify({
              answer: 'No — keep cricket indoors until Today 14:00–17:00.',
              verdict: 'no',
              why: 'PM2.5 is 102 µg/m³ right now across Delhi.',
              bestTime: 'Today 14:00–17:00',
              dataUsed: ['NAQI 245 (Poor)'],
            }),
          };
        }),
      },
    };

    const { server, baseUrl } = await startTestServer(slowAi, 20);
    try {
      const [a1, a2] = await Promise.all([
        fetch(`${baseUrl}/api/advice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(VALID_ADVICE_BODY),
        }),
        fetch(`${baseUrl}/api/advice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(VALID_ADVICE_BODY),
        }),
      ]);
      expect(a1.status).toBe(200);
      expect(a2.status).toBe(200);
      expect(generateCalls).toBe(1);

      // Cached follow-up hits adviceCache without invoking Gemini
      const a3 = await fetch(`${baseUrl}/api/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ADVICE_BODY),
      });
      expect(a3.status).toBe(200);
      expect(generateCalls).toBe(1);

      // Concurrent /api/ask dedupe + cache hit
      const [q1, q2] = await Promise.all([
        fetch(`${baseUrl}/api/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(VALID_ASK_BODY),
        }),
        fetch(`${baseUrl}/api/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(VALID_ASK_BODY),
        }),
      ]);
      expect(q1.status).toBe(200);
      expect(q2.status).toBe(200);
      expect(generateCalls).toBe(2);

      const q3 = await fetch(`${baseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_ASK_BODY),
      });
      expect(q3.status).toBe(200);
      expect(generateCalls).toBe(2);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('serves production index.html with injected per-request CSP nonce and returns 404 when absent', async () => {
    const fs = await import('node:fs');
    const existsSpy = vi.spyOn(fs.default, 'existsSync');
    const readSpy = vi.spyOn(fs.default.promises, 'readFile');

    try {
      existsSpy.mockReturnValue(true);
      readSpy.mockResolvedValueOnce(
        '<!doctype html><html><head><meta property="csp-nonce" nonce="__CSP_NONCE__" /></head><body><script src="/assets/app.js"></script></body></html>'
      );

      const okHtml = await fetch(`${okBaseUrl}/`);
      expect(okHtml.status).toBe(200);
      expect(okHtml.headers.get('cache-control')).toBe('no-cache');
      const csp = okHtml.headers.get('content-security-policy') ?? '';
      const nonceMatch = csp.match(/'nonce-([^']+)'/);
      expect(nonceMatch).toBeTruthy();
      const body = await okHtml.text();
      expect(body).toContain(`nonce="${nonceMatch?.[1] ?? ''}"`);

      existsSpy.mockReturnValue(false);
      const missingHtml = await fetch(`${okBaseUrl}/`);
      expect(missingHtml.status).toBe(404);
    } finally {
      existsSpy.mockRestore();
      readSpy.mockRestore();
    }
  });
});
