import { describe, expect, it } from 'vitest';
import {
  applyThemeCssVariables,
  computeHazeOpacity,
  resolveThemeTokens,
  selectWeatherScene,
} from '../theme/theme.ts';
import type { NaqiCategory } from '../../types/index.ts';

function parseRgb(color: string): [number, number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return [r, g, b, 1];
  }
  const match = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/
  );
  if (!match) {
    throw new Error(`Unsupported color format: ${color}`);
  }
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] !== undefined ? Number(match[4]) : 1,
  ];
}

function compositeOver(fg: string, bg: string): [number, number, number] {
  const [fr, fgC, fb, fa] = parseRgb(fg);
  const [br, bgC, bb] = parseRgb(bg);
  return [
    Math.round(fr * fa + br * (1 - fa)),
    Math.round(fgC * fa + bgC * (1 - fa)),
    Math.round(fb * fa + bb * (1 - fa)),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(
  c1: [number, number, number],
  c2: [number, number, number]
): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Theme & Atmospheric Scene Engine', () => {
  it('maps each NAQI category to a distinct palette and non-color badge icon', () => {
    const categories: NaqiCategory[] = [
      'Good',
      'Satisfactory',
      'Moderate',
      'Poor',
      'Very Poor',
      'Severe',
    ];

    const accents = new Set<string>();
    const icons = new Set<string>();

    for (const category of categories) {
      const tokens = resolveThemeTokens({
        category,
        weatherCode: 0,
        isDay: true,
        pm25: 35,
        humidityPct: 50,
        windSpeedKmh: 10,
      });
      expect(tokens.category).toBe(category);
      expect(tokens.scrim).toContain('rgba(');
      accents.add(tokens.accent);
      icons.add(tokens.badgeIcon);
    }

    expect(accents.size).toBe(6);
    expect(icons.size).toBe(6);
  });

  it('meets WCAG AA (>= 4.5:1) contrast across all 6 NAQI categories in day and night modes', () => {
    const categories: NaqiCategory[] = [
      'Good',
      'Satisfactory',
      'Moderate',
      'Poor',
      'Very Poor',
      'Severe',
    ];

    for (const category of categories) {
      for (const isDay of [true, false]) {
        const tokens = resolveThemeTokens({
          category,
          weatherCode: 0,
          isDay,
          pm25: 120,
        });

        const scrimBg = compositeOver(tokens.scrim, tokens.skyBottom);
        const glassBg = compositeOver(tokens.surfaceGlass, tokens.skyMid);

        const primaryOnScrim = contrastRatio(
          compositeOver(tokens.textPrimary, '#000000'),
          scrimBg
        );
        const mutedOnGlass = contrastRatio(
          compositeOver(tokens.textMuted, '#000000'),
          glassBg
        );
        const pillTextContrast = contrastRatio(
          compositeOver(tokens.accentContrast, '#000000'),
          compositeOver(tokens.accent, '#000000')
        );

        expect(primaryOnScrim).toBeGreaterThanOrEqual(4.5);
        expect(mutedOnGlass).toBeGreaterThanOrEqual(4.5);
        expect(pillTextContrast).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('selects weather scenes from weather_code, humidity, and wind speed', () => {
    // Clear (0-1)
    expect(
      selectWeatherScene({ weatherCode: 0, humidityPct: 45, windSpeedKmh: 12 })
    ).toBe('clear');
    expect(selectWeatherScene({ weatherCode: 1, humidityPct: 60, windSpeedKmh: 8 })).toBe(
      'clear'
    );

    // Cloudy (2-3)
    expect(
      selectWeatherScene({ weatherCode: 2, humidityPct: 55, windSpeedKmh: 10 })
    ).toBe('cloudy');
    expect(selectWeatherScene({ weatherCode: 3, humidityPct: 70, windSpeedKmh: 7 })).toBe(
      'cloudy'
    );

    // Fog: weather_code 45, 48 OR (humidity > 85 && wind < 5)
    expect(
      selectWeatherScene({ weatherCode: 45, humidityPct: 60, windSpeedKmh: 10 })
    ).toBe('fog');
    expect(
      selectWeatherScene({ weatherCode: 48, humidityPct: 70, windSpeedKmh: 10 })
    ).toBe('fog');
    expect(selectWeatherScene({ weatherCode: 1, humidityPct: 88, windSpeedKmh: 4 })).toBe(
      'fog'
    );
    expect(selectWeatherScene({ weatherCode: 1, humidityPct: 88, windSpeedKmh: 8 })).toBe(
      'clear'
    );

    // Rain (51-67, 80-82)
    expect(
      selectWeatherScene({ weatherCode: 51, humidityPct: 90, windSpeedKmh: 3 })
    ).toBe('rain');
    expect(
      selectWeatherScene({ weatherCode: 63, humidityPct: 85, windSpeedKmh: 14 })
    ).toBe('rain');
    expect(
      selectWeatherScene({ weatherCode: 80, humidityPct: 80, windSpeedKmh: 18 })
    ).toBe('rain');

    // Thunder (95+)
    expect(
      selectWeatherScene({ weatherCode: 95, humidityPct: 90, windSpeedKmh: 25 })
    ).toBe('thunder');
    expect(
      selectWeatherScene({ weatherCode: 99, humidityPct: 92, windSpeedKmh: 30 })
    ).toBe('thunder');
  });

  it('tracks day vs night via is_day, scales haze opacity with PM2.5, dims sun in smog, and applies CSS variables', () => {
    expect(computeHazeOpacity(5)).toBe(0.08);
    expect(computeHazeOpacity(130)).toBeGreaterThan(0.45);
    expect(computeHazeOpacity(300)).toBe(0.9);

    const clearDay = resolveThemeTokens({
      category: 'Good',
      weatherCode: 0,
      isDay: true,
      pm25: 18,
    });
    const clearNight = resolveThemeTokens({
      category: 'Good',
      weatherCode: 0,
      isDay: false,
      pm25: 18,
    });
    const smogDay = resolveThemeTokens({
      category: 'Very Poor',
      weatherCode: 0,
      isDay: true,
      pm25: 180,
    });

    expect(clearDay.isDay).toBe(true);
    expect(clearDay.sunColor).toBe('#fef08a');
    expect(clearNight.isDay).toBe(false);
    expect(clearNight.skyTop).toBe('#070b17');
    expect(clearNight.sunColor).toBe('#e2e8f0');
    expect(smogDay.sunColor).toBe('#ea580c');
    expect(smogDay.hazeOpacity).toBeGreaterThan(clearDay.hazeOpacity);

    const setProps: Record<string, string> = {};
    const mockEl = {
      style: {
        setProperty: (k: string, v: string) => {
          setProps[k] = v;
        },
      },
    } as unknown as HTMLElement;

    applyThemeCssVariables(mockEl, smogDay);
    expect(setProps['--vm-accent']).toBe(smogDay.accent);
    expect(setProps['--vm-haze-opacity']).toBe(String(smogDay.hazeOpacity));
    expect(setProps['--vm-scrim']).toBe(smogDay.scrim);
  });
});
