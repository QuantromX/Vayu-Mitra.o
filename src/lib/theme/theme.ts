import type {
  NaqiCategory,
  ThemeTokens,
  WeatherConditionScene,
} from '../../types/index.ts';

interface CategoryPalette {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  accent: string;
  accentStrong: string;
  accentContrast: string;
  surfaceGlass: string;
  surfaceElevated: string;
  borderGlass: string;
  scrim: string;
  badgeIcon: ThemeTokens['badgeIcon'];
  hazeColor: string;
}

const CATEGORY_PALETTES: Record<NaqiCategory, CategoryPalette> = {
  Good: {
    skyTop: '#062c30',
    skyMid: '#0b4a4e',
    skyBottom: '#116d66',
    accent: '#2dd4bf',
    accentStrong: '#14b8a6',
    accentContrast: '#032320',
    surfaceGlass: 'rgba(6, 31, 35, 0.78)',
    surfaceElevated: 'rgba(10, 44, 49, 0.9)',
    borderGlass: 'rgba(153, 246, 228, 0.24)',
    scrim: 'rgba(3, 18, 20, 0.62)',
    badgeIcon: 'shield-check',
    hazeColor: 'rgba(167, 243, 208, 0.18)',
  },
  Satisfactory: {
    skyTop: '#162d1a',
    skyMid: '#244723',
    skyBottom: '#3c622b',
    accent: '#a3e635',
    accentStrong: '#84cc16',
    accentContrast: '#142605',
    surfaceGlass: 'rgba(17, 34, 19, 0.78)',
    surfaceElevated: 'rgba(26, 48, 28, 0.9)',
    borderGlass: 'rgba(217, 249, 157, 0.24)',
    scrim: 'rgba(10, 22, 12, 0.64)',
    badgeIcon: 'leaf',
    hazeColor: 'rgba(217, 249, 157, 0.2)',
  },
  Moderate: {
    skyTop: '#2e2008',
    skyMid: '#4c340e',
    skyBottom: '#714a14',
    accent: '#fbbf24',
    accentStrong: '#f59e0b',
    accentContrast: '#291702',
    surfaceGlass: 'rgba(34, 23, 8, 0.8)',
    surfaceElevated: 'rgba(49, 34, 12, 0.92)',
    borderGlass: 'rgba(253, 230, 138, 0.24)',
    scrim: 'rgba(20, 13, 4, 0.66)',
    badgeIcon: 'cloud-sun',
    hazeColor: 'rgba(252, 211, 77, 0.24)',
  },
  Poor: {
    skyTop: '#331507',
    skyMid: '#59230b',
    skyBottom: '#823410',
    accent: '#fb923c',
    accentStrong: '#f97316',
    accentContrast: '#2b0e02',
    surfaceGlass: 'rgba(38, 17, 8, 0.8)',
    surfaceElevated: 'rgba(56, 25, 11, 0.92)',
    borderGlass: 'rgba(254, 215, 170, 0.24)',
    scrim: 'rgba(22, 9, 4, 0.68)',
    badgeIcon: 'alert-triangle',
    hazeColor: 'rgba(251, 146, 60, 0.28)',
  },
  'Very Poor': {
    skyTop: '#320b10',
    skyMid: '#58121a',
    skyBottom: '#7f1d27',
    accent: '#f87171',
    accentStrong: '#ef4444',
    accentContrast: '#2b0608',
    surfaceGlass: 'rgba(38, 10, 14, 0.82)',
    surfaceElevated: 'rgba(56, 15, 21, 0.92)',
    borderGlass: 'rgba(254, 202, 202, 0.24)',
    scrim: 'rgba(22, 5, 8, 0.72)',
    badgeIcon: 'flame',
    hazeColor: 'rgba(248, 113, 113, 0.32)',
  },
  Severe: {
    skyTop: '#1e091f',
    skyMid: '#371138',
    skyBottom: '#531946',
    accent: '#e879f9',
    accentStrong: '#c026d3',
    accentContrast: '#230526',
    surfaceGlass: 'rgba(25, 9, 28, 0.84)',
    surfaceElevated: 'rgba(40, 14, 44, 0.94)',
    borderGlass: 'rgba(245, 208, 254, 0.26)',
    scrim: 'rgba(15, 4, 18, 0.74)',
    badgeIcon: 'skull',
    hazeColor: 'rgba(192, 132, 252, 0.34)',
  },
};

/**
 * Determines the weather scene from WMO weather_code, humidity, and wind speed:
 * - thunder: weatherCode >= 95
 * - rain: weatherCode 51..67 or 80..82
 * - fog: weatherCode 45, 48 OR (humidityPct > 85 && windSpeedKmh < 5)
 * - cloudy: weatherCode 2..3
 * - clear: weatherCode 0..1 (or fallback)
 */
export function selectWeatherScene(params: {
  weatherCode: number;
  humidityPct?: number;
  windSpeedKmh?: number;
}): WeatherConditionScene {
  const { weatherCode, humidityPct = 50, windSpeedKmh = 10 } = params;

  if (weatherCode >= 95) {
    return 'thunder';
  }

  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return 'rain';
  }

  if (
    weatherCode === 45 ||
    weatherCode === 48 ||
    (humidityPct > 85 && windSpeedKmh < 5)
  ) {
    return 'fog';
  }

  if (weatherCode === 2 || weatherCode === 3) {
    return 'cloudy';
  }

  return 'clear';
}

/**
 * Computes haze opacity (0.08 to 0.9) scaled smoothly with PM2.5 concentration.
 */
export function computeHazeOpacity(pm25: number): number {
  if (!Number.isFinite(pm25) || pm25 <= 10) return 0.08;
  const normalized = Math.min(1, (pm25 - 10) / 240);
  return Number((0.08 + normalized * 0.82).toFixed(2));
}

/**
 * Computes complete theme tokens combining NAQI category palette with weather conditions & is_day.
 */
export function resolveThemeTokens(params: {
  category: NaqiCategory;
  weatherCode: number;
  isDay: boolean;
  pm25: number;
  humidityPct?: number;
  windSpeedKmh?: number;
}): ThemeTokens {
  const palette = CATEGORY_PALETTES[params.category];
  const weatherScene = selectWeatherScene({
    weatherCode: params.weatherCode,
    humidityPct: params.humidityPct,
    windSpeedKmh: params.windSpeedKmh,
  });
  const hazeOpacity = computeHazeOpacity(params.pm25);

  // Nighttime deepens the upper sky while retaining the NAQI category accent and lower glow
  const skyTop = params.isDay ? palette.skyTop : '#070b17';
  const skyMid = params.isDay ? palette.skyMid : '#10182b';

  // Sun/moon disc dims and turns orange-red in elevated PM2.5 smog
  let sunColor = '#fef08a';
  let sunGlow = 'rgba(254, 240, 138, 0.52)';
  if (!params.isDay) {
    sunColor = '#e2e8f0';
    sunGlow = 'rgba(226, 232, 240, 0.35)';
  } else if (params.pm25 >= 121) {
    sunColor = '#ea580c';
    sunGlow = 'rgba(234, 88, 12, 0.24)';
  } else if (params.pm25 >= 61) {
    sunColor = '#fb923c';
    sunGlow = 'rgba(251, 146, 60, 0.32)';
  }

  return {
    category: params.category,
    weatherScene,
    isDay: params.isDay,
    hazeOpacity,
    skyTop,
    skyMid,
    skyBottom: palette.skyBottom,
    accent: palette.accent,
    accentStrong: palette.accentStrong,
    accentContrast: palette.accentContrast,
    glowColor: palette.hazeColor,
    ringTrack: 'rgba(255, 255, 255, 0.14)',
    surfaceGlass: palette.surfaceGlass,
    surfaceElevated: palette.surfaceElevated,
    borderGlass: palette.borderGlass,
    scrim: palette.scrim,
    textPrimary: '#f8fafc',
    textSecondary: '#e2e8f0',
    textMuted: '#cbd5e1',
    hazeColor: palette.hazeColor,
    sunColor,
    sunGlow,
    badgeIcon: palette.badgeIcon,
  };
}

/**
 * Applies theme tokens as CSS custom properties onto a DOM element.
 */
export function applyThemeCssVariables(element: HTMLElement, tokens: ThemeTokens): void {
  const s = element.style;
  s.setProperty('--vm-sky-top', tokens.skyTop);
  s.setProperty('--vm-sky-mid', tokens.skyMid);
  s.setProperty('--vm-sky-bottom', tokens.skyBottom);
  s.setProperty('--vm-accent', tokens.accent);
  s.setProperty('--vm-accent-strong', tokens.accentStrong);
  s.setProperty('--vm-accent-contrast', tokens.accentContrast);
  s.setProperty('--vm-glow', tokens.glowColor);
  s.setProperty('--vm-ring-track', tokens.ringTrack);
  s.setProperty('--vm-surface-glass', tokens.surfaceGlass);
  s.setProperty('--vm-surface-elevated', tokens.surfaceElevated);
  s.setProperty('--vm-border-glass', tokens.borderGlass);
  s.setProperty('--vm-scrim', tokens.scrim);
  s.setProperty('--vm-text-primary', tokens.textPrimary);
  s.setProperty('--vm-text-secondary', tokens.textSecondary);
  s.setProperty('--vm-text-muted', tokens.textMuted);
  s.setProperty('--vm-haze-color', tokens.hazeColor);
  s.setProperty('--vm-haze-opacity', String(tokens.hazeOpacity));
  s.setProperty('--vm-sun-color', tokens.sunColor);
  s.setProperty('--vm-sun-glow', tokens.sunGlow);
}
