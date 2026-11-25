import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudSun,
  Flame,
  Info,
  Leaf,
  RefreshCw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Skull,
  WifiOff,
} from 'lucide-react';
import { NAQI_CATEGORY_RANGES } from '../lib/naqi/naqi';
import { CATEGORY_HINDI } from '../lib/shared/domain';
import type {
  CityLocation,
  Language,
  NaqiResult,
  ScrubbedHourState,
  ThemeTokens,
  VerdictPillLevel,
} from '../types';
import { AqiRingGauge } from './AqiRingGauge';
import { HeroSkylineScene } from './SkylineBackdrop';

export { CATEGORY_HINDI };

interface HeroReadoutProps {
  city: CityLocation;
  naqi: NaqiResult | null;
  scrubbed: ScrubbedHourState | null;
  theme: ThemeTokens;
  loading: boolean;
  lastUpdated: Date | null;
  isOfflineData?: boolean;
  language: Language;
  sharing: boolean;
  shareNotice: string | null;
  onRefresh: () => void;
  onShareCard: () => void;
}

function CategoryIcon({
  icon,
  className,
}: {
  icon: ThemeTokens['badgeIcon'];
  className?: string;
}) {
  switch (icon) {
    case 'shield-check':
      return <ShieldCheck className={className} aria-hidden="true" />;
    case 'leaf':
      return <Leaf className={className} aria-hidden="true" />;
    case 'cloud-sun':
      return <CloudSun className={className} aria-hidden="true" />;
    case 'alert-triangle':
      return <AlertTriangle className={className} aria-hidden="true" />;
    case 'flame':
      return <Flame className={className} aria-hidden="true" />;
    case 'skull':
      return <Skull className={className} aria-hidden="true" />;
  }
}

function VerdictIcon({ level }: { level: VerdictPillLevel }) {
  if (level === 'GO') {
    return <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />;
  }
  if (level === 'CAUTION') {
    return <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />;
  }
  return <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />;
}

export const HeroReadout: React.FC<HeroReadoutProps> = React.memo(
  ({
    city,
    naqi,
    scrubbed,
    theme,
    loading,
    lastUpdated,
    isOfflineData = false,
    language,
    sharing,
    shareNotice,
    onRefresh,
    onShareCard,
  }) => {
    const hi = language === 'hi';
    const [rangesOpen, setRangesOpen] = useState(false);

    const formattedUpdated = lastUpdated
      ? lastUpdated.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata',
        })
      : null;

    const activeCategory = scrubbed?.category ?? naqi?.category ?? 'Good';
    const activeAqi = scrubbed?.aqi ?? naqi?.aqi ?? 0;
    const activeDominant =
      scrubbed?.dominantPollutant ?? naqi?.dominantPollutant ?? 'PM2.5';
    const activePm25 = scrubbed?.pm25 ?? naqi?.pm25Used ?? 0;
    const activePm10 = scrubbed?.pm10 ?? naqi?.pm10Used ?? 0;

    const categoryLabel = hi ? CATEGORY_HINDI[activeCategory] : activeCategory;

    const windowDescriptor =
      activeCategory === 'Good'
        ? hi
          ? 'सबसे स्वच्छ समय'
          : 'Cleanest window ahead'
        : hi
          ? 'कम प्रदूषण वाला समय'
          : 'Lowest-pollution window ahead';

    const cleanDayLabel = naqi?.cleanestWindow
      ? hi
        ? naqi.cleanestWindow.dayLabel === 'Today'
          ? 'आज'
          : 'कल'
        : naqi.cleanestWindow.dayLabel
      : '';

    const scrubbedDayLabel = scrubbed
      ? hi
        ? scrubbed.dayLabel === 'Today'
          ? 'आज'
          : 'कल'
        : scrubbed.dayLabel
      : '';

    return (
      <section
        aria-label={hi ? 'वर्तमान वायु गुणवत्ता दृश्य' : 'Live air quality hero scene'}
        className="relative rounded-[28px] p-5 sm:p-8 border border-white/20 shadow-2xl min-h-[360px] sm:min-h-[400px] flex flex-col justify-between"
      >
        {/* Full-width atmospheric canvas + parallax skyline + scrim clipped inside Hero radius */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] overflow-hidden"
          aria-hidden="true"
        >
          <HeroSkylineScene
            cityName={city.name}
            theme={theme}
            pm25={activePm25}
            sunXPercent={scrubbed?.sunXPercent ?? 82}
            sunYPercent={scrubbed?.sunYPercent ?? 18}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${theme.scrim} 0%, rgba(2, 6, 23, 0.56) 56%, rgba(2, 6, 23, 0.8) 100%)`,
            }}
          />
        </div>

        <div className="relative z-10 space-y-6">
          {/* Top row: City + Share + Refresh */}
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-2xl sm:text-4xl font-semibold tracking-tight text-white min-w-0 text-balance">
                {city.name}
                {city.admin1 ? (
                  <span className="text-slate-200 font-normal text-lg sm:text-2xl">
                    , {city.admin1}
                  </span>
                ) : null}
              </h1>

              <div className="flex items-center gap-2 shrink-0">
                {naqi && (
                  <button
                    type="button"
                    onClick={onShareCard}
                    disabled={sharing}
                    aria-label={hi ? 'एयर कार्ड साझा करें' : 'Share Air Card'}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/65 border border-white/25 text-xs font-medium text-white hover:bg-slate-900/85 disabled:opacity-50 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {sharing
                        ? hi
                          ? 'बना रहा है...'
                          : 'Rendering...'
                        : hi
                          ? 'एयर कार्ड साझा करें'
                          : 'Share Air Card'}
                    </span>
                    <span className="sm:hidden">{hi ? 'साझा करें' : 'Share'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  aria-label={hi ? 'डेटा रीफ़्रेश करें' : 'Refresh live readings'}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/65 border border-white/25 text-xs font-medium text-white hover:bg-slate-900/85 disabled:opacity-50 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">{hi ? 'रीफ़्रेश' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-200">
              <span>
                {hi ? 'भारत वायु सूचकांक अनुमान' : (naqi?.label ?? 'NAQI-style estimate')}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {scrubbed && !scrubbed.isLive
                  ? hi
                    ? `अनुमानित समय: ${scrubbedDayLabel} ${scrubbed.hourLabel}`
                    : `Preview: ${scrubbedDayLabel} ${scrubbed.hourLabel}`
                  : naqi?.basis === 'rolling_24h'
                    ? hi
                      ? '24 घंटे औसत आधार'
                      : 'Rolling 24h avg'
                    : hi
                      ? 'वर्तमान माप'
                      : 'Current reading'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{hi ? 'डेटा: Open-Meteo' : 'Data: Open-Meteo'}</span>
              {isOfflineData && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-300 text-slate-950 font-bold">
                    <WifiOff className="w-3 h-3" aria-hidden="true" />
                    <span>{hi ? 'ऑफ़लाइन' : 'Offline'}</span>
                  </span>
                </>
              )}
              {formattedUpdated && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    {hi ? `अपडेट ${formattedUpdated}` : `Updated ${formattedUpdated} IST`}
                  </span>
                </>
              )}
              {shareNotice && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-white font-medium" role="status">
                    {shareNotice}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Centerpiece: Animated AQI Ring Gauge + Category + Verdict Pill + Cleanest Window */}
          {loading && !naqi ? (
            <div
              className="py-4 flex flex-col sm:flex-row items-center gap-6"
              aria-busy="true"
            >
              <div className="w-[172px] h-[172px] rounded-full vm-shimmer border border-white/15 shrink-0" />
              <div className="space-y-3 flex-1 w-full">
                <div className="h-8 w-44 rounded-xl vm-shimmer" />
                <div className="h-5 w-72 rounded-lg vm-shimmer" />
              </div>
            </div>
          ) : naqi && scrubbed ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <AqiRingGauge
                  aqi={activeAqi}
                  categoryLabel={categoryLabel}
                  theme={theme}
                />

                <div className="space-y-3">
                  {/* Category icon + label + NAQI range tooltip */}
                  <div className="relative flex items-center gap-2.5">
                    <span
                      className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/25 bg-slate-950/75"
                      style={{ color: theme.accent }}
                    >
                      <CategoryIcon icon={theme.badgeIcon} className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1">
                        <span
                          className="font-display text-xl sm:text-2xl font-semibold tracking-tight"
                          style={{ color: theme.accent }}
                          data-testid="hero-naqi-category"
                        >
                          {categoryLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRangesOpen((prev) => !prev)}
                          aria-expanded={rangesOpen}
                          aria-controls="naqi-ranges-tooltip"
                          aria-label={
                            hi ? 'वायु सूचकांक श्रेणी सीमाएँ देखें' : 'View NAQI category ranges'
                          }
                          className="min-h-[44px] min-w-[44px] -my-2 inline-flex items-center justify-center rounded-lg text-slate-200 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          <Info className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="text-xs text-slate-200">
                        {hi
                          ? `प्रमुख प्रदूषक: ${activeDominant}`
                          : `Dominant: ${activeDominant}`}
                      </div>
                    </div>

                    {rangesOpen && (
                      <div
                        id="naqi-ranges-tooltip"
                        role="region"
                        aria-label={
                          hi ? 'भारत वायु सूचकांक श्रेणियाँ' : 'India NAQI category ranges'
                        }
                        className="absolute left-0 top-full mt-2 z-30 w-64 rounded-2xl bg-slate-950/95 border border-white/25 p-3.5 shadow-2xl space-y-1.5"
                      >
                        <div className="text-xs font-semibold text-white pb-1 border-b border-white/15">
                          {hi ? 'भारत वायु सूचकांक श्रेणियाँ' : 'India NAQI Ranges'}
                        </div>
                        {NAQI_CATEGORY_RANGES.map((item) => (
                          <div
                            key={item.category}
                            className="flex items-center justify-between text-xs text-slate-200"
                          >
                            <span>{hi ? item.categoryHi : item.category}</span>
                            <span className="font-mono-tabular text-white font-medium">
                              {item.range}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Verdict Pill: GO / CAUTION / STAY IN + 1 human line */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      data-testid="hero-verdict-pill"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide whitespace-nowrap shadow-sm"
                      style={{
                        backgroundColor: theme.accent,
                        color: theme.accentContrast,
                      }}
                    >
                      <VerdictIcon level={scrubbed.verdictPill} />
                      <span>{scrubbed.verdictLabel}</span>
                    </span>
                    <span
                      className="text-sm sm:text-base font-medium text-white leading-snug"
                      aria-live="polite"
                    >
                      {scrubbed.verdictLine}
                    </span>
                  </div>
                </div>
              </div>

              {naqi.cleanestWindow && (
                <div className="text-xs md:text-right text-slate-200 space-y-0.5 bg-slate-950/60 border border-white/15 rounded-2xl px-4 py-3 shrink-0">
                  <div className="text-slate-300">{windowDescriptor}</div>
                  <div className="font-mono-tabular text-sm font-semibold text-white">
                    {cleanDayLabel} {naqi.cleanestWindow.startHour}–
                    {naqi.cleanestWindow.endHour}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Tabular pollutant & weather strip */}
          {naqi && scrubbed && (
            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-white/20">
              <div>
                <dt className="text-xs text-slate-300">PM2.5</dt>
                <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
                  {activePm25}{' '}
                  <span className="text-xs font-normal text-slate-300">µg/m³</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-300">PM10</dt>
                <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
                  {activePm10}{' '}
                  <span className="text-xs font-normal text-slate-300">µg/m³</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-300">{hi ? 'तापमान' : 'Temp'}</dt>
                <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
                  {scrubbed.temperatureC}°C
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-300">{hi ? 'नमी' : 'Humidity'}</dt>
                <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
                  {scrubbed.humidityPct}%
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-300">{hi ? 'हवा' : 'Wind'}</dt>
                <dd className="font-mono-tabular text-base font-semibold text-white mt-0.5">
                  {scrubbed.windSpeedKmh}{' '}
                  <span className="text-xs font-normal text-slate-300">km/h</span>
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>
    );
  }
);

HeroReadout.displayName = 'HeroReadout';
