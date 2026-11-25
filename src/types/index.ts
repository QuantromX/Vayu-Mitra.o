export type NaqiCategory =
  'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe';

export type WeatherConditionScene = 'clear' | 'cloudy' | 'fog' | 'rain' | 'thunder';

export type Language = 'en' | 'hi';

export type VerdictPillLevel = 'GO' | 'CAUTION' | 'STAY IN';

export type HouseholdGroup =
  'kids' | 'seniors' | 'pregnant' | 'asthma_heart' | 'outdoor_worker';

export type LifestyleMode =
  | 'wfh'
  | 'commute_bike'
  | 'commute_car'
  | 'commute_metro'
  | 'commute_bus'
  | 'runner_walker';

export interface CityLocation {
  id: number;
  name: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export interface UserProfile {
  city: CityLocation;
  household: HouseholdGroup[];
  lifestyle: LifestyleMode;
  hasPurifier: boolean;
  language: Language;
}

export interface SampleProfile {
  id: string;
  label: string;
  labelHi: string;
  subtitle: string;
  subtitleHi: string;
  profile: UserProfile;
}

export type WindowDayLabel = 'Today' | 'Tomorrow';

export interface HourlyPollutantPoint {
  time: string; // YYYY-MM-DDTHH:mm in Asia/Kolkata
  hourLabel: string; // e.g. "06:00"
  dayLabel: WindowDayLabel;
  isCurrentHour: boolean;
  pm2_5: number | null;
  pm10: number | null;
  naqi: number | null;
  category: NaqiCategory | null;
}

export interface HourlyWeatherPoint {
  time: string;
  temperatureC: number | null;
  windSpeedKmh: number | null;
  weatherCode: number | null;
}

export interface AirQualityData {
  latitude: number;
  longitude: number;
  currentTime: string;
  currentPm25: number;
  currentPm10: number;
  hourly: HourlyPollutantPoint[];
  fetchedAt: string;
}

export interface WeatherData {
  currentTime: string;
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  weatherCode: number;
  isDay: boolean;
  hourly?: HourlyWeatherPoint[];
  fetchedAt: string;
}

export interface HourWindow {
  startHour: string;
  endHour: string;
  dayLabel: WindowDayLabel;
  endDayLabel: WindowDayLabel;
  startIndex: number; // index inside forwardHourly
  endIndex: number;
  avgNaqi: number;
  avgPm25: number;
}

export interface NaqiResult {
  aqi: number;
  category: NaqiCategory;
  dominantPollutant: 'PM2.5' | 'PM10';
  pm25SubIndex: number;
  pm10SubIndex: number;
  pm25Used: number;
  pm10Used: number;
  basis: 'rolling_24h' | 'current';
  label: string;
  cleanestWindow: HourWindow | null;
  worstWindow: HourWindow | null;
  forwardHourly: HourlyPollutantPoint[];
}

export interface ThemeTokens {
  category: NaqiCategory;
  weatherScene: WeatherConditionScene;
  isDay: boolean;
  hazeOpacity: number;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  accent: string;
  accentStrong: string;
  accentContrast: string;
  glowColor: string;
  ringTrack: string;
  surfaceGlass: string;
  surfaceElevated: string;
  borderGlass: string;
  scrim: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  hazeColor: string;
  sunColor: string;
  sunGlow: string;
  badgeIcon: 'shield-check' | 'leaf' | 'cloud-sun' | 'alert-triangle' | 'flame' | 'skull';
}

export interface ScrubbedHourState {
  index: number;
  isLive: boolean;
  time: string;
  hourLabel: string;
  dayLabel: WindowDayLabel;
  aqi: number;
  category: NaqiCategory;
  dominantPollutant: 'PM2.5' | 'PM10';
  pm25: number;
  pm10: number;
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  weatherCode: number;
  isDay: boolean;
  sunXPercent: number; // 12..88 across sky
  sunYPercent: number; // 10..44 across sky arc
  verdictPill: VerdictPillLevel;
  verdictLabel: string;
  verdictLine: string;
}

export interface ShareCardSpec {
  width: 1080;
  height: 1350;
  cityTitle: string;
  aqi: number;
  categoryLabel: string;
  verdictLabel: string;
  verdictHeadline: string;
  topActions: string[];
  attribution: string;
  updatedLabel: string;
  altText: string;
  theme: ThemeTokens;
}

export interface AdviceActionItem {
  action: string;
  why: string;
  timeWindow?: string;
}

export interface RoutineActionItem {
  action: string;
  why: string;
  co2Benefit?: string;
}

export interface AdviceResponse {
  verdict: {
    level: NaqiCategory;
    headline: string;
    summary: string;
  };
  outdoor: AdviceActionItem[];
  indoor: AdviceActionItem[];
  routine: RoutineActionItem[];
  mask: {
    recommended: boolean;
    type: string;
    why: string;
  };
  forWhom: Array<{
    group: string;
    advice: string;
  }>;
  disclaimer: string;
  source: 'gemini' | 'fallback';
}

export type AskVerdict = 'yes' | 'no' | 'caution';

export interface AskResponse {
  answer: string;
  verdict: AskVerdict;
  why: string;
  bestTime?: string;
  dataUsed: string[];
  disclaimer: string;
  source: 'gemini' | 'fallback';
}

export type PhotoCheckConfidence = 'low' | 'medium' | 'high';
export type PhotoSceneHint = 'auto' | 'room' | 'sky';

export interface PhotoCheckResponse {
  observations: string[];
  purifierPlacement: string;
  ventilationTip: string;
  confidence: PhotoCheckConfidence;
  disclaimer: string;
  source: 'gemini' | 'fallback';
}
