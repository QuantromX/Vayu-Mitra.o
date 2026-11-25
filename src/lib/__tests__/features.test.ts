import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildActionId,
  buildPlanStorageKey,
  collectPlanActionIds,
  computePlanProgress,
  loadCompletedActions,
  saveCompletedActions,
  toggleActionDone,
  triggerHapticTap,
} from '../advice/progress.ts';
import {
  computeScrubbedHourState,
  computeSunArcPosition,
  getVerdictPill,
  getVerdictPillLabel,
} from '../naqi/scrubber.ts';
import {
  DEFAULT_PROFILE,
  loadSavedProfile,
  saveProfileToStorage,
} from '../profiles/samples.ts';
import {
  buildShareCardSpec,
  renderShareCardBlob,
  shareOrDownloadAirCard,
} from '../share/shareCard.ts';
import { resolveThemeTokens } from '../theme/theme.ts';
import { stripExifFromImage } from '../vision/exifStrip.ts';
import type { AdviceResponse, NaqiResult, WeatherData } from '../../types/index.ts';

const MOCK_NAQI: NaqiResult = {
  aqi: 165,
  category: 'Moderate',
  dominantPollutant: 'PM2.5',
  pm25Used: 79,
  pm10Used: 120,
  pm25SubIndex: 165,
  pm10SubIndex: 113,
  basis: 'rolling_24h',
  label: 'NAQI-style estimate',
  cleanestWindow: {
    startIndex: 2,
    endIndex: 4,
    startHour: '15:00',
    endHour: '17:00',
    dayLabel: 'Today',
    endDayLabel: 'Today',
    avgNaqi: 90,
    avgPm25: 54,
  },
  worstWindow: {
    startIndex: 6,
    endIndex: 8,
    startHour: '19:00',
    endHour: '21:00',
    dayLabel: 'Today',
    endDayLabel: 'Today',
    avgNaqi: 245,
    avgPm25: 103,
  },
  forwardHourly: [
    {
      time: '2026-04-12T13:00',
      hourLabel: '13:00',
      dayLabel: 'Today',
      isCurrentHour: true,
      pm2_5: 78,
      pm10: 118,
      naqi: 160,
      category: 'Moderate',
    },
    {
      time: '2026-04-12T14:00',
      hourLabel: '14:00',
      dayLabel: 'Today',
      isCurrentHour: false,
      pm2_5: 42,
      pm10: 70,
      naqi: 70,
      category: 'Satisfactory',
    },
    {
      time: '2026-04-12T22:00',
      hourLabel: '22:00',
      dayLabel: 'Today',
      isCurrentHour: false,
      pm2_5: 135,
      pm10: 210,
      naqi: 312,
      category: 'Very Poor',
    },
  ],
};

const MOCK_WEATHER: WeatherData = {
  temperatureC: 31,
  humidityPct: 48,
  windSpeedKmh: 11,
  weatherCode: 0,
  isDay: true,
  currentTime: '2026-04-12T13:00',
  fetchedAt: '2026-04-12T13:00:00Z',
  hourly: [
    {
      time: '2026-04-12T14:00',
      temperatureC: 33,
      windSpeedKmh: 15,
      weatherCode: 2,
    },
    {
      time: '2026-04-12T22:00',
      temperatureC: 24,
      windSpeedKmh: 4,
      weatherCode: 45,
    },
  ],
};

const MOCK_ADVICE: AdviceResponse = {
  verdict: {
    level: 'Moderate',
    headline: 'Keep outdoor play lighter today',
    summary: 'Afternoon breezes improve dispersion briefly.',
  },
  mask: {
    recommended: true,
    type: 'N95 / FFP2',
    why: 'Fine PM2.5 rises sharply after sunset.',
  },
  outdoor: [
    {
      action: 'Schedule walks between 14:00 and 17:00',
      timeWindow: '14:00–17:00',
      why: 'Lower dispersion peak',
    },
    { action: 'Avoid roadside jogging near traffic', why: 'Exhaust concentration' },
  ],
  indoor: [
    {
      action: 'Run HEPA purifier in bedrooms after 19:00',
      why: 'Evening inversion traps smoke',
    },
  ],
  routine: [
    {
      action: 'Batch evening errands into one metro trip',
      co2Benefit: 'Approx. 1.4 kg CO2 saved',
      why: 'Lower exposure and tailpipe dust',
    },
  ],
  forWhom: [{ group: 'Kids', advice: 'Move evening play indoors after 19:00.' }],
  disclaimer: 'Informational guidance only.',
  source: 'fallback',
};

describe('Time Scrubber state mapping', () => {
  it('maps verdict pills by NAQI category and household sensitivity', () => {
    expect(getVerdictPill('Good', [])).toBe('GO');
    expect(getVerdictPill('Satisfactory', ['kids'])).toBe('GO');
    expect(getVerdictPill('Moderate', [])).toBe('GO');
    expect(getVerdictPill('Moderate', ['kids'])).toBe('CAUTION');
    expect(getVerdictPill('Moderate', ['asthma_heart'])).toBe('CAUTION');
    expect(getVerdictPill('Poor', [])).toBe('STAY IN');
    expect(getVerdictPill('Severe', ['kids'])).toBe('STAY IN');

    expect(getVerdictPillLabel('CAUTION', 'hi')).toBe('सावधानी रखें');
    expect(getVerdictPillLabel('STAY IN', 'en')).toBe('STAY IN');
  });

  it('computes day sun arc and night moon arc coordinates cleanly', () => {
    const noon = computeSunArcPosition(12);
    expect(noon.isDay).toBe(true);
    expect(noon.sunYPercent).toBeLessThan(16);
    expect(noon.sunXPercent).toBe(50);

    const night = computeSunArcPosition(22);
    expect(night.isDay).toBe(false);
    expect(night.sunXPercent).toBeGreaterThanOrEqual(18);
  });

  it('returns live state at index 0 and updates metrics, sky day/night, and verdict when scrubbed', () => {
    const live = computeScrubbedHourState({
      naqi: MOCK_NAQI,
      weather: MOCK_WEATHER,
      activeIndex: 0,
      household: ['kids'],
      language: 'en',
    });
    expect(live.isLive).toBe(true);
    expect(live.aqi).toBe(165);
    expect(live.verdictPill).toBe('CAUTION');
    expect(live.temperatureC).toBe(31);

    const nightScrub = computeScrubbedHourState({
      naqi: MOCK_NAQI,
      weather: MOCK_WEATHER,
      activeIndex: 2,
      household: ['kids'],
      language: 'en',
    });
    expect(nightScrub.isLive).toBe(false);
    expect(nightScrub.isDay).toBe(false);
    expect(nightScrub.temperatureC).toBe(24);
    expect(nightScrub.windSpeedKmh).toBe(4);
    expect(nightScrub.weatherCode).toBe(45);
    expect(nightScrub.verdictPill).toBe('STAY IN');
    expect(nightScrub.aqi).toBeGreaterThan(250);
  });
});

describe('Today plan action completion progress', () => {
  it('collects IDs, toggles state idempotently, and computes progress percentage', () => {
    const ids = collectPlanActionIds(MOCK_ADVICE);
    expect(ids).toEqual(['outdoor:0', 'outdoor:1', 'indoor:0', 'routine:0']);

    let done = toggleActionDone([], buildActionId('outdoor', 0));
    expect(done).toEqual(['outdoor:0']);
    done = toggleActionDone(done, buildActionId('indoor', 0));
    expect(done).toEqual(['outdoor:0', 'indoor:0']);

    const progress = computePlanProgress(ids, done);
    expect(progress).toEqual({ completed: 2, total: 4, pct: 50 });

    done = toggleActionDone(done, buildActionId('outdoor', 0));
    expect(computePlanProgress(ids, done)).toEqual({ completed: 1, total: 4, pct: 25 });
  });

  it('generates stable IST date-scoped storage keys', () => {
    const key = buildPlanStorageKey('New Delhi', new Date('2026-04-12T10:00:00Z'));
    expect(key).toBe('vayumitra_plan_done_v1:2026-04-12:new-delhi');
  });
});

describe('Share Air Card data builder', () => {
  it('builds a 1080x1350 spec with top 2 actions and Open-Meteo attribution', () => {
    const theme = resolveThemeTokens({
      category: 'Poor',
      weatherCode: 45,
      isDay: false,
      pm25: 110,
      humidityPct: 88,
      windSpeedKmh: 3,
    });

    const spec = buildShareCardSpec({
      cityName: 'Delhi',
      admin1: 'Delhi',
      aqi: 266,
      categoryLabel: 'Poor',
      verdictLabel: 'STAY IN',
      verdictHeadline: MOCK_ADVICE.verdict.headline,
      advice: MOCK_ADVICE,
      theme,
      updatedLabel: '22:00 IST',
      language: 'en',
    });

    expect(spec.width).toBe(1080);
    expect(spec.height).toBe(1350);
    expect(spec.topActions).toEqual([
      'Schedule walks between 14:00 and 17:00',
      'Run HEPA purifier in bedrooms after 19:00',
    ]);
    expect(spec.attribution).toContain('Data: Open-Meteo');
    expect(spec.altText).toContain('NAQI 266');
  });

  it('provides localized fallback actions when advice is unavailable', () => {
    const theme = resolveThemeTokens({
      category: 'Good',
      weatherCode: 0,
      isDay: true,
      pm25: 15,
    });

    const spec = buildShareCardSpec({
      cityName: 'Mysuru',
      aqi: 34,
      categoryLabel: 'अच्छी',
      verdictLabel: 'बाहर जा सकते हैं',
      verdictHeadline: 'साफ़ हवा',
      advice: null,
      theme,
      updatedLabel: '09:00 IST',
      language: 'hi',
    });

    expect(spec.topActions.length).toBe(2);
    expect(spec.attribution).toContain('Open-Meteo');
    expect(spec.altText).toContain('Mysuru');
  });
});

describe('Storage helpers, Share Card canvas rendering, and EXIF stripper', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('persists and loads completed actions and user profiles safely in localStorage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
      setTimeout: globalThis.setTimeout,
    });
    vi.stubGlobal('navigator', {
      vibrate: vi.fn(),
    });

    expect(saveCompletedActions('k1', ['outdoor:0', 'indoor:0'])).toBe(true);
    expect(loadCompletedActions('k1')).toEqual(['outdoor:0', 'indoor:0']);
    triggerHapticTap(10);

    const customProfile = {
      ...DEFAULT_PROFILE,
      language: 'hi' as const,
      hasPurifier: false,
    };
    expect(saveProfileToStorage(customProfile)).toBe(true);
    expect(loadSavedProfile()).toEqual(customProfile);

    // Corrupted JSON falls back cleanly
    store.set('vayumitra_user_profile_v1', '{bad-json');
    expect(loadSavedProfile()).toEqual(DEFAULT_PROFILE);
  });

  it('renders Share Air Card PNG blob and triggers download/Web Share flows', async () => {
    const mockGrad = { addColorStop: vi.fn() };
    const mockCtx = {
      createLinearGradient: () => mockGrad,
      createRadialGradient: () => mockGrad,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: (txt: string) => ({ width: txt.length * 10 }),
      drawImage: vi.fn(),
    };
    const fakeBlob = new Blob(['png-bytes'], { type: 'image/png' });
    const fakeAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'a') return fakeAnchor;
        return {
          width: 0,
          height: 0,
          getContext: () => mockCtx,
          toBlob: (cb: (b: Blob | null) => void) => cb(fakeBlob),
        };
      },
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:air-card'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('navigator', {});

    const theme = resolveThemeTokens({
      category: 'Moderate',
      weatherCode: 2,
      isDay: true,
      pm25: 79,
    });
    const spec = buildShareCardSpec({
      cityName: 'Delhi',
      aqi: 165,
      categoryLabel: 'Moderate',
      verdictLabel: 'CAUTION',
      verdictHeadline: MOCK_ADVICE.verdict.headline,
      advice: MOCK_ADVICE,
      theme,
      updatedLabel: '13:00 IST',
      language: 'en',
    });

    const rendered = await renderShareCardBlob(spec);
    expect(rendered.type).toBe('image/png');

    const downloadRes = await shareOrDownloadAirCard(spec);
    expect(downloadRes).toBe('downloaded');
    expect(fakeAnchor.click).toHaveBeenCalledTimes(1);

    // Web Share API path
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: vi.fn(async () => undefined),
    });
    const sharedRes = await shareOrDownloadAirCard(spec);
    expect(sharedRes).toBe('shared');
  });

  it('strips EXIF via canvas re-encoding cleanly', async () => {
    const mockCtx = { drawImage: vi.fn() };
    const cleanBlob = new Blob(['clean-jpeg'], { type: 'image/jpeg' });
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => mockCtx,
        toBlob: (cb: (b: Blob | null) => void) => cb(cleanBlob),
      }),
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-preview'),
      revokeObjectURL: vi.fn(),
    });

    class MockImage {
      naturalWidth = 2400;
      naturalHeight = 1200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    class MockFileReader {
      result: string | null = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.onload?.();
      }
    }

    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('FileReader', MockFileReader);

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'room.jpg', {
      type: 'image/jpeg',
    });
    const stripped = await stripExifFromImage(file);
    expect(stripped.mimeType).toBe('image/jpeg');
    expect(stripped.imageBase64).toBe('/9j/4AAQSkZJRgABAQ==');
    expect(stripped.previewUrl).toBe('blob:mock-preview');
  });

  it('handles ValidationError, RateLimitError, and malformed stored coordinates safely', async () => {
    const { ValidationError, RateLimitError } = await import('../errors.ts');
    const vErr = new ValidationError('Invalid coordinate range', [
      'latitude out of bounds',
    ]);
    expect(vErr.statusCode).toBe(400);
    expect(vErr.code).toBe('VALIDATION_ERROR');
    expect(vErr.details).toEqual(['latitude out of bounds']);

    const rErr = new RateLimitError('Slow down', 30);
    expect(rErr.statusCode).toBe(429);
    expect(rErr.code).toBe('RATE_LIMIT_ERROR');
    expect(rErr.retryAfterSec).toBe(30);

    const store = new Map<string, string>();
    store.set(
      'vayumitra_user_profile_v1',
      JSON.stringify({
        ...DEFAULT_PROFILE,
        city: { ...DEFAULT_PROFILE.city, latitude: 'bad' },
      })
    );
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    });
    expect(loadSavedProfile()).toEqual(DEFAULT_PROFILE);
  });
});
