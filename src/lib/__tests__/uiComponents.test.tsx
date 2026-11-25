// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.tsx';
import { AdviceCardsGrid, VerdictAndMaskCard } from '../../components/AdviceSection.tsx';
import AskVayuMitra from '../../components/AskVayuMitra.tsx';
import { DataConfidenceCard } from '../../components/DataConfidenceCard.tsx';
import { ErrorBanner } from '../../components/ErrorBanner.tsx';
import { ErrorBoundary } from '../../components/ErrorBoundary.tsx';
import { HeroReadout } from '../../components/HeroReadout.tsx';
import PhotoCheckCard from '../../components/PhotoCheckCard.tsx';
import { ProfileControls } from '../../components/ProfileControls.tsx';
import { TimeScrubber } from '../../components/TimeScrubber.tsx';
import { clearOpenMeteoCache, saveLastKnownSnapshot } from '../api/openMeteo.ts';
import { evaluateAirQuality } from '../naqi/naqi.ts';
import { computeScrubbedHourState } from '../naqi/scrubber.ts';
import { DEFAULT_PROFILE } from '../profiles/samples.ts';
import { resolveThemeTokens } from '../theme/theme.ts';
import type { AdviceResponse, AirQualityData, WeatherData } from '../../types/index.ts';

interface WithAxeMatchers<R, _T> {
  toHaveNoViolations(): R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<R, T> extends WithAxeMatchers<R, T> {}
}

expect.extend(toHaveNoViolations);

function buildHourlyOpenMeteoAirPayload() {
  const times: string[] = [];
  const pm25: number[] = [];
  const pm10: number[] = [];
  for (let day = 22; day <= 23; day++) {
    for (let h = 0; h < 24; h++) {
      times.push(`2026-11-${day}T${String(h).padStart(2, '0')}:00`);
      pm25.push(h >= 14 && h <= 16 ? 48 : 112);
      pm10.push(h >= 14 && h <= 16 ? 88 : 185);
    }
  }
  return {
    latitude: 28.65,
    longitude: 77.23,
    current: { time: '2026-11-22T10:00', pm2_5: 112, pm10: 185 },
    hourly: { time: times, pm2_5: pm25, pm10 },
  };
}

function buildHourlyOpenMeteoWeatherPayload() {
  const times: string[] = [];
  const temps: number[] = [];
  const winds: number[] = [];
  const codes: number[] = [];
  for (let day = 22; day <= 23; day++) {
    for (let h = 0; h < 24; h++) {
      times.push(`2026-11-${day}T${String(h).padStart(2, '0')}:00`);
      temps.push(24);
      winds.push(8);
      codes.push(1);
    }
  }
  return {
    current: {
      time: '2026-11-22T10:00',
      temperature_2m: 24,
      relative_humidity_2m: 56,
      wind_speed_10m: 8,
      weather_code: 1,
      is_day: 1,
    },
    hourly: {
      time: times,
      temperature_2m: temps,
      wind_speed_10m: winds,
      weather_code: codes,
    },
  };
}

const SAMPLE_ADVICE: AdviceResponse = {
  verdict: {
    level: 'Poor',
    headline: 'Cut outdoor exertion; shift errands to Today 14:00–17:00',
    summary: 'Fine PM2.5 is elevated across Delhi right now.',
  },
  outdoor: [
    {
      action: 'Shift walks to Today 14:00–17:00.',
      why: 'Afternoon mixing reduces particulate density.',
      timeWindow: 'Today 14:00–17:00',
    },
  ],
  indoor: [
    {
      action: 'Run HEPA purifier on high during peak evening hours.',
      why: 'Keeps indoor PM2.5 infiltration controlled.',
    },
  ],
  routine: [
    {
      action: 'Use the metro instead of solo driving.',
      why: 'Reduces roadside particle exposure and tailpipe dust.',
      co2Benefit: 'Approx. 1.4 kg CO2 saved (assumes 10 km car vs metro)',
    },
  ],
  mask: {
    recommended: true,
    type: 'N95 / FFP2',
    why: 'Poor NAQI recommends N95 outdoors for everyone.',
  },
  forWhom: [{ group: 'Children', advice: 'Keep evening sports indoors today.' }],
  disclaimer:
    'NAQI-style estimate, not medical advice. Grounded in Open-Meteo readings; consult a doctor for symptoms.',
  source: 'fallback',
};

function makeNaqiAndWeatherFixtures(): {
  air: AirQualityData;
  weather: WeatherData;
} {
  const airRaw = buildHourlyOpenMeteoAirPayload();
  const weatherRaw = buildHourlyOpenMeteoWeatherPayload();
  const air: AirQualityData = {
    latitude: airRaw.latitude,
    longitude: airRaw.longitude,
    currentTime: airRaw.current.time,
    currentPm25: airRaw.current.pm2_5,
    currentPm10: airRaw.current.pm10,
    hourly: airRaw.hourly.time.map((time, idx) => ({
      time,
      hourLabel: time.slice(11, 16),
      dayLabel: 'Today',
      isCurrentHour: false,
      pm2_5: airRaw.hourly.pm2_5[idx] ?? null,
      pm10: airRaw.hourly.pm10[idx] ?? null,
      naqi: null,
      category: null,
    })),
    fetchedAt: '2026-11-22T04:30:00Z',
  };
  const weather: WeatherData = {
    currentTime: weatherRaw.current.time,
    temperatureC: weatherRaw.current.temperature_2m,
    humidityPct: weatherRaw.current.relative_humidity_2m,
    windSpeedKmh: weatherRaw.current.wind_speed_10m,
    weatherCode: weatherRaw.current.weather_code,
    isDay: true,
    hourly: weatherRaw.hourly.time.map((time, idx) => ({
      time,
      temperatureC: weatherRaw.hourly.temperature_2m[idx] ?? null,
      windSpeedKmh: weatherRaw.hourly.wind_speed_10m[idx] ?? null,
      weatherCode: weatherRaw.hourly.weather_code[idx] ?? null,
    })),
    fetchedAt: '2026-11-22T04:30:00Z',
  };
  return { air, weather };
}

describe('UI Components, Accessibility & End-to-End Flows', () => {
  beforeEach(() => {
    clearOpenMeteoCache();
    localStorage.clear();
    document.documentElement.lang = 'en';

    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    clearOpenMeteoCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('scrubs 24h timeline via keyboard arrows, Home/End, and Reset button', () => {
    const { air, weather } = makeNaqiAndWeatherFixtures();
    const naqi = evaluateAirQuality(air);
    const theme = resolveThemeTokens({
      category: naqi.category,
      weatherCode: weather.weatherCode,
      isDay: weather.isDay,
      pm25: naqi.pm25Used,
    });
    const scrubbed = computeScrubbedHourState({
      naqi,
      weather,
      activeIndex: 2,
      household: DEFAULT_PROFILE.household,
      language: 'en',
    });

    const onChangeIndex = vi.fn();
    render(
      <TimeScrubber
        hourly={naqi.forwardHourly}
        activeIndex={2}
        scrubbed={scrubbed}
        cleanestWindow={naqi.cleanestWindow}
        worstWindow={naqi.worstWindow}
        category={naqi.category}
        theme={theme}
        language="en"
        onChangeIndex={onChangeIndex}
        onOpenDetails={vi.fn()}
      />
    );

    const slider = screen.getByRole('slider', {
      name: /Forward 24-hour NAQI scrubber/i,
    });
    expect(slider).toHaveAttribute('aria-valuenow', '2');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChangeIndex).toHaveBeenCalledWith(3);

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onChangeIndex).toHaveBeenCalledWith(1);

    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChangeIndex).toHaveBeenCalledWith(naqi.forwardHourly.length - 1);

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChangeIndex).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole('button', { name: /Back to now/i }));
    expect(onChangeIndex).toHaveBeenLastCalledWith(0);
  });

  it('syncs <html lang="en|hi">, displays visible disclaimer, and supports offline snapshot fallback + retry recovery', async () => {
    const { air, weather } = makeNaqiAndWeatherFixtures();
    saveLastKnownSnapshot(DEFAULT_PROFILE.city.id, air, weather);

    let failLive = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('open-meteo')) {
        if (failLive) {
          return new Response('Offline', { status: 503 });
        }
        if (url.includes('air-quality-api')) {
          return new Response(JSON.stringify(buildHourlyOpenMeteoAirPayload()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(buildHourlyOpenMeteoWeatherPayload()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(SAMPLE_ADVICE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    // Falls back gracefully to saved offline snapshot with visible Offline badge & Retry
    await waitFor(
      () => {
        expect(screen.getByTestId('offline-badge')).toHaveTextContent('Offline');
      },
      { timeout: 5000 }
    );
    expect(screen.getByText(/Showing last saved snapshot/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/NAQI-style estimate, not medical advice/i).length
    ).toBeGreaterThan(0);

    // Language switch toggles <html lang="hi"> and back to "en"
    const hiBtn = screen.getByRole('button', { name: 'हिन्दी' });
    fireEvent.click(hiBtn);
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('hi');
    });

    const enBtn = screen.getByRole('button', { name: 'EN' });
    fireEvent.click(enBtn);
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
    });

    // Retry when network returns clears offline error banner
    failLive = false;
    const retryBtn = screen.getByRole('button', { name: /^Retry$/i });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(screen.queryByText(/Showing last saved snapshot/i)).toBeNull();
    });
  });

  it('catches rendering crashes cleanly inside ErrorBoundary', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Boom(): never {
      throw new Error('Synthetic render failure');
    }

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      /VayuMitra hit an unexpected display error/i
    );
    expect(screen.getByRole('button', { name: /Reload VayuMitra/i })).toBeInTheDocument();
    consoleErr.mockRestore();
  });

  it('passes axe-core automated WCAG accessibility checks across all main cards', async () => {
    const { air, weather } = makeNaqiAndWeatherFixtures();
    const naqi = evaluateAirQuality(air);
    const theme = resolveThemeTokens({
      category: naqi.category,
      weatherCode: weather.weatherCode,
      isDay: weather.isDay,
      pm25: naqi.pm25Used,
    });
    const scrubbed = computeScrubbedHourState({
      naqi,
      weather,
      activeIndex: 0,
      household: DEFAULT_PROFILE.household,
      language: 'en',
    });

    const { container } = render(
      <main>
        <ErrorBanner
          message="Temporary outage"
          language="en"
          isOfflineData
          offlineSavedAt="2026-11-22T10:00:00Z"
          onRetry={vi.fn()}
        />
        <HeroReadout
          city={DEFAULT_PROFILE.city}
          naqi={naqi}
          scrubbed={scrubbed}
          theme={theme}
          loading={false}
          lastUpdated={new Date('2026-11-22T10:00:00Z')}
          language="en"
          sharing={false}
          shareNotice={null}
          onRefresh={vi.fn()}
          onShareCard={vi.fn()}
        />
        <TimeScrubber
          hourly={naqi.forwardHourly}
          activeIndex={0}
          scrubbed={scrubbed}
          cleanestWindow={naqi.cleanestWindow}
          worstWindow={naqi.worstWindow}
          category={naqi.category}
          theme={theme}
          language="en"
          onChangeIndex={vi.fn()}
          onOpenDetails={vi.fn()}
        />
        <VerdictAndMaskCard
          advice={SAMPLE_ADVICE}
          loading={false}
          revealStage={3}
          language="en"
          theme={theme}
          errorNotice={null}
          onRetryAdvice={vi.fn()}
        />
        <ProfileControls
          profile={DEFAULT_PROFILE}
          activeSampleId="delhi-kids"
          isOpen
          onToggleOpen={vi.fn()}
          onSelectCity={vi.fn()}
          onToggleHousehold={vi.fn()}
          onChangeLifestyle={vi.fn()}
          onChangePurifier={vi.fn()}
          onApplySample={vi.fn()}
        />
        <AdviceCardsGrid
          advice={SAMPLE_ADVICE}
          loading={false}
          revealStage={3}
          language="en"
          theme={theme}
          completedIds={['outdoor:0']}
          planProgress={{ completed: 1, total: 3, pct: 33 }}
          onToggleDone={vi.fn()}
        />
        <AskVayuMitra
          profile={DEFAULT_PROFILE}
          naqi={naqi}
          weather={weather}
          theme={theme}
        />
        <PhotoCheckCard profile={DEFAULT_PROFILE} naqi={naqi} theme={theme} />
        <DataConfidenceCard
          cityName={DEFAULT_PROFILE.city.name}
          naqi={naqi}
          lastUpdated={new Date('2026-11-22T10:00:00Z')}
          language="en"
          theme={theme}
        />
      </main>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders HourlyDetailsSheet and ShortcutsModal dialogs with Escape dismissal and zero axe violations', async () => {
    const { default: HourlyDetailsSheet } =
      await import('../../components/HourlyDetailsSheet.tsx');
    const { default: ShortcutsModal } =
      await import('../../components/ShortcutsModal.tsx');

    const { air, weather } = makeNaqiAndWeatherFixtures();
    const naqi = evaluateAirQuality(air);
    const theme = resolveThemeTokens({
      category: naqi.category,
      weatherCode: weather.weatherCode,
      isDay: weather.isDay,
      pm25: naqi.pm25Used,
    });
    const scrubbed = computeScrubbedHourState({
      naqi,
      weather,
      activeIndex: 0,
      household: DEFAULT_PROFILE.household,
      language: 'en',
    });

    const onCloseHourly = vi.fn();
    const onCloseShortcuts = vi.fn();
    const onStepHour = vi.fn();

    const { container } = render(
      <div>
        <HourlyDetailsSheet
          open
          scrubbed={scrubbed}
          totalHours={naqi.forwardHourly.length}
          theme={theme}
          language="en"
          onClose={onCloseHourly}
          onStepHour={onStepHour}
        />
        <ShortcutsModal open language="en" onClose={onCloseShortcuts} />
      </div>
    );

    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(2);

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseHourly).toHaveBeenCalledTimes(1);
    expect(onCloseShortcuts).toHaveBeenCalledTimes(1);
  });
});
