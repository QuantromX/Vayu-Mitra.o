import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOpenMeteoCache,
  fetchAirQuality,
  fetchWeather,
  loadLastKnownSnapshot,
  saveLastKnownSnapshot,
  searchIndianCities,
} from '../api/openMeteo.ts';

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Open-Meteo API Client (Mocked Fetch, 10m Cache & In-Flight Dedupe)', () => {
  beforeEach(() => {
    clearOpenMeteoCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearOpenMeteoCache();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('caches city search for 10 minutes, deduplicates concurrent requests, and handles empty results', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('NowhereCity')) {
        return mockJsonResponse({});
      }
      return mockJsonResponse({
        results: [
          {
            id: 1273294,
            name: 'Delhi',
            admin1: 'National Capital Territory of Delhi',
            latitude: 28.65195,
            longitude: 77.23149,
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    // Concurrent calls for the same query share 1 network fetch
    const [a, b] = await Promise.all([
      searchIndianCities('Delhi'),
      searchIndianCities('  delhi '),
    ]);
    expect(a).toHaveLength(1);
    expect(b).toEqual(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Subsequent call within 10 minutes hits cache
    const c = await searchIndianCities('Delhi');
    expect(c).toEqual(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Empty geocode result returns [] cleanly
    expect(await searchIndianCities('NowhereCity')).toEqual([]);

    // Short queries (<2 chars) skip fetch
    expect(await searchIndianCities('D')).toEqual([]);
  });

  it('caches air quality & weather responses for 10 minutes and supports forceRefresh', async () => {
    const airPayload = {
      latitude: 28.65,
      longitude: 77.23,
      current: { time: '2026-11-23T10:00', pm2_5: 112.4, pm10: 185.2 },
      hourly: {
        time: ['2026-11-23T10:00', '2026-11-23T11:00'],
        pm2_5: [112.4, 108.1],
        pm10: [185.2, 179.0],
      },
    };
    const weatherPayload = {
      current: {
        time: '2026-11-23T10:00',
        temperature_2m: 23.4,
        relative_humidity_2m: 56,
        wind_speed_10m: 8.2,
        weather_code: 1,
        is_day: 1,
      },
      hourly: {
        time: ['2026-11-23T10:00', '2026-11-23T11:00'],
        temperature_2m: [23.4, 24.8],
        wind_speed_10m: [8.2, 9.5],
        weather_code: [1, 1],
      },
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('air-quality-api')) return mockJsonResponse(airPayload);
      return mockJsonResponse(weatherPayload);
    });
    vi.stubGlobal('fetch', fetchMock);

    // Deduplicated concurrent air quality fetches
    const [air1, air2] = await Promise.all([
      fetchAirQuality(28.65, 77.23),
      fetchAirQuality(28.65, 77.23),
    ]);
    expect(air1.currentPm25).toBe(112.4);
    expect(air2).toEqual(air1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Force refresh bypasses cache
    await fetchAirQuality(28.65, 77.23, { forceRefresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Weather dedupe + cache hit
    const [w1, w2] = await Promise.all([
      fetchWeather(28.65, 77.23),
      fetchWeather(28.65, 77.23),
    ]);
    expect(w1.temperatureC).toBe(23);
    expect(w1.isDay).toBe(true);
    expect(w2).toEqual(w1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await fetchWeather(28.65, 77.23);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries transient HTTP 503 with backoff, handles timeouts, and rejects invalid coordinates', async () => {
    let calls = 0;
    const flakyFetch = vi.fn(async () => {
      calls += 1;
      if (calls < 3) {
        return new Response('Busy', { status: 503 });
      }
      return mockJsonResponse({
        latitude: 19.07,
        longitude: 72.87,
        current: { time: '2026-11-23T10:00', pm2_5: 62, pm10: 110 },
        hourly: { time: ['2026-11-23T10:00'], pm2_5: [62], pm10: [110] },
      });
    });
    vi.stubGlobal('fetch', flakyFetch);

    const recovered = await fetchAirQuality(19.07, 72.87, {
      maxRetries: 2,
      retryBaseDelayMs: 1,
    });
    expect(recovered.currentPm25).toBe(62);
    expect(flakyFetch).toHaveBeenCalledTimes(3);

    // Exhausted retries & incomplete payload fail cleanly
    clearOpenMeteoCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Server error', { status: 503 }))
    );
    await expect(
      fetchAirQuality(19.07, 72.87, { maxRetries: 1, retryBaseDelayMs: 1 })
    ).rejects.toThrow(/HTTP 503/);
    await expect(fetchWeather(19.07, 72.87, { maxRetries: 0 })).rejects.toThrow(
      /HTTP 503/
    );
    await expect(searchIndianCities('Mumbai', { maxRetries: 0 })).rejects.toThrow(
      /HTTP 503/
    );

    clearOpenMeteoCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockJsonResponse({ current: {} }))
    );
    await expect(fetchAirQuality(19.07, 72.87, { maxRetries: 0 })).rejects.toThrow(
      /Incomplete/
    );

    // Timeout throws 504 timeout error cleanly
    clearOpenMeteoCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      )
    );
    await expect(
      fetchAirQuality(19.07, 72.87, { timeoutMs: 10, maxRetries: 0 })
    ).rejects.toThrow(/timed out/);

    await expect(fetchAirQuality(Number.NaN, 77.2)).rejects.toThrow(
      /Invalid geographic coordinates/
    );
  });

  it('serves stale-while-revalidate snapshot after 10m TTL and refreshes in background', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T10:00:00Z'));

    let version = 1;
    const swrFetch = vi.fn(async () =>
      mockJsonResponse({
        latitude: 28.65,
        longitude: 77.23,
        current: {
          time: '2026-11-23T10:00',
          pm2_5: version === 1 ? 80 : 55,
          pm10: 120,
        },
        hourly: { time: ['2026-11-23T10:00'], pm2_5: [80], pm10: [120] },
      })
    );
    vi.stubGlobal('fetch', swrFetch);

    const first = await fetchAirQuality(28.65, 77.23);
    expect(first.currentPm25).toBe(80);

    // Advance 11 minutes (past 10m fresh TTL, still inside 6h stale window)
    version = 2;
    vi.advanceTimersByTime(11 * 60 * 1000);

    const staleHit = await fetchAirQuality(28.65, 77.23);
    expect(staleHit.currentPm25).toBe(80);
    await vi.runAllTimersAsync();

    const refreshed = await fetchAirQuality(28.65, 77.23);
    expect(refreshed.currentPm25).toBe(55);
  });

  it('persists and loads offline last-known Open-Meteo snapshots safely', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    });

    const air = {
      latitude: 28.65,
      longitude: 77.23,
      currentTime: '2026-11-23T10:00',
      currentPm25: 90,
      currentPm10: 140,
      hourly: [],
      fetchedAt: '2026-11-23T10:00:00Z',
    };
    const weather = {
      currentTime: '2026-11-23T10:00',
      temperatureC: 25,
      humidityPct: 50,
      windSpeedKmh: 8,
      weatherCode: 1,
      isDay: true,
      hourly: [],
      fetchedAt: '2026-11-23T10:00:00Z',
    };

    expect(saveLastKnownSnapshot(1273294, air, weather)).toBe(true);
    const loaded = loadLastKnownSnapshot(1273294);
    expect(loaded?.air.currentPm25).toBe(90);
    expect(loadLastKnownSnapshot(999999)).toBeNull();
  });
});
