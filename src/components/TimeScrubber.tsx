import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, Flame, Info, RotateCcw } from 'lucide-react';
import { triggerHapticTap } from '../lib/advice/progress';
import type {
  HourWindow,
  HourlyPollutantPoint,
  Language,
  NaqiCategory,
  ScrubbedHourState,
  ThemeTokens,
  WindowDayLabel,
} from '../types';

interface TimeScrubberProps {
  hourly: HourlyPollutantPoint[];
  activeIndex: number;
  scrubbed: ScrubbedHourState | null;
  cleanestWindow: HourWindow | null;
  worstWindow: HourWindow | null;
  category: NaqiCategory;
  theme: ThemeTokens;
  language: Language;
  onChangeIndex: (index: number) => void;
  onOpenDetails: () => void;
}

function dayLabelText(day: WindowDayLabel, hi: boolean): string {
  if (!hi) return day;
  return day === 'Today' ? 'आज' : 'कल';
}

function barColorForCategory(cat: NaqiCategory | null): string {
  switch (cat) {
    case 'Good':
      return '#2dd4bf';
    case 'Satisfactory':
      return '#a3e635';
    case 'Moderate':
      return '#fbbf24';
    case 'Poor':
      return '#fb923c';
    case 'Very Poor':
      return '#f87171';
    case 'Severe':
      return '#e879f9';
    default:
      return 'rgba(255, 255, 255, 0.35)';
  }
}

/**
 * Signature 24-hour interactive timeline scrubber directly under the Hero.
 * Supports pointer drag, tap selection, and keyboard arrow/Home/End scrubbing
 * with live ARIA announcements, "Back to now" reset, and Hourly Details sheet trigger.
 */
export const TimeScrubber: React.FC<TimeScrubberProps> = React.memo(
  ({
    hourly,
    activeIndex,
    scrubbed,
    cleanestWindow,
    worstWindow,
    category,
    theme,
    language,
    onChangeIndex,
    onOpenDetails,
  }) => {
    const hi = language === 'hi';
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const maxNaqi = useMemo(() => {
      const maxVal = hourly.reduce((m, pt) => Math.max(m, pt.naqi ?? 0), 100);
      return Math.max(120, Math.ceil(maxVal / 50) * 50);
    }, [hourly]);

    if (hourly.length === 0) {
      return null;
    }

    const resolveIndexFromClientX = (clientX: number) => {
      const el = trackRef.current;
      if (!el) return activeIndex;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return activeIndex;
      const ratio = Math.max(0, Math.min(0.9999, (clientX - rect.left) / rect.width));
      return Math.min(hourly.length - 1, Math.floor(ratio * hourly.length));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic pointer events
      }
      const nextIdx = resolveIndexFromClientX(e.clientX);
      if (nextIdx !== activeIndex) {
        triggerHapticTap(8);
        onChangeIndex(nextIdx);
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const nextIdx = resolveIndexFromClientX(e.clientX);
      if (nextIdx !== activeIndex) {
        onChangeIndex(nextIdx);
      }
    };

    const handlePointerUp = () => {
      if (dragging) setDragging(false);
    };

    const handleTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.min(hourly.length - 1, activeIndex + 1);
        triggerHapticTap(8);
        onChangeIndex(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const prev = Math.max(0, activeIndex - 1);
        triggerHapticTap(8);
        onChangeIndex(prev);
      } else if (e.key === 'Home') {
        e.preventDefault();
        onChangeIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        onChangeIndex(hourly.length - 1);
      }
    };

    const cleanWord =
      category === 'Good'
        ? hi
          ? 'स्वच्छ समय:'
          : 'Cleanest:'
        : hi
          ? 'न्यूनतम प्रदूषण:'
          : 'Lowest-AQI:';

    const activePoint = hourly[activeIndex] ?? hourly[0];
    if (!activePoint) {
      return null;
    }
    const announcement = scrubbed
      ? hi
        ? `${dayLabelText(scrubbed.dayLabel, true)} ${scrubbed.hourLabel}: वायु सूचकांक ${scrubbed.aqi}, ${scrubbed.verdictLabel}। ${scrubbed.verdictLine}`
        : `${dayLabelText(scrubbed.dayLabel, false)} ${scrubbed.hourLabel}: NAQI ${scrubbed.aqi}, ${scrubbed.verdictLabel}. ${scrubbed.verdictLine}`
      : '';

    return (
      <section
        aria-label={hi ? '24 घंटे टाइम स्क्रबर' : 'Next 24 hours forward time scrubber'}
        className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {hi ? '24 घंटे समय स्क्रबर' : 'Next 24h time scrubber'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {hi
                ? 'किसी भी घंटे पर टैप, ड्रैग या तीर कुंजी से स्क्रब करें — ऊपर का पूरा दृश्य लाइव बदलता है।'
                : 'Drag, tap, or use arrow keys to preview any hour live in the hero scene.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeIndex !== 0 && (
              <button
                type="button"
                onClick={() => {
                  triggerHapticTap(10);
                  onChangeIndex(0);
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-100 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{hi ? 'अभी पर लौटें' : 'Back to now'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenDetails}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950/65 border border-white/20 text-xs font-medium text-white hover:bg-slate-900/85 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Info className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{hi ? 'घंटे का विवरण' : 'Hour details'}</span>
            </button>
          </div>
        </div>

        {/* Cleanest & Peak window metadata */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-200">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
            <span>{hi ? 'अभी (पहला बार)' : 'Now (1st bar)'}</span>
          </span>
          {cleanestWindow && (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2
                className="w-3.5 h-3.5"
                style={{ color: theme.accent }}
                aria-hidden="true"
              />
              <span>
                {cleanWord}{' '}
                <strong className="font-mono-tabular text-white">
                  {dayLabelText(cleanestWindow.dayLabel, hi)} {cleanestWindow.startHour}–
                  {cleanestWindow.endHour}
                </strong>
              </span>
            </span>
          )}
          {worstWindow && (
            <span className="inline-flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>
                {hi ? 'अधिकतम धुंध:' : 'Peak:'}{' '}
                <strong className="font-mono-tabular text-white">
                  {dayLabelText(worstWindow.dayLabel, hi)} {worstWindow.startHour}–
                  {worstWindow.endHour}
                </strong>
              </span>
            </span>
          )}
        </div>

        {/* Interactive 24h colored NAQI scrub strip */}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={hi ? 'आगामी 24 घंटे वायु स्क्रबर' : 'Forward 24-hour NAQI scrubber'}
          aria-valuemin={0}
          aria-valuemax={hourly.length - 1}
          aria-valuenow={activeIndex}
          aria-valuetext={announcement}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleTrackKeyDown}
          className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px] sm:gap-1 items-end h-44 pt-7 px-1 rounded-2xl touch-none select-none cursor-ew-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {hourly.map((pt, idx) => {
            const val = pt.naqi ?? 0;
            const heightPct = Math.max(14, Math.round((val / maxNaqi) * 100));
            const inClean =
              cleanestWindow !== null &&
              idx >= cleanestWindow.startIndex &&
              idx <= cleanestWindow.endIndex;
            const inWorst =
              worstWindow !== null &&
              idx >= worstWindow.startIndex &&
              idx <= worstWindow.endIndex;
            const isSelected = idx === activeIndex;
            const isNow = pt.isCurrentHour;

            const barColor = barColorForCategory(pt.category);
            const showCleanTag = inClean && idx === cleanestWindow?.startIndex;
            const showWorstTag = inWorst && idx === worstWindow?.startIndex;

            return (
              <div
                key={pt.time}
                className={`relative flex flex-col items-center justify-end h-full min-h-[44px] rounded-md transition-colors ${
                  isSelected ? 'bg-white/15' : ''
                }`}
              >
                {isNow && (
                  <span className="absolute -top-6 left-0 text-xs font-semibold whitespace-nowrap text-sky-200">
                    {hi ? 'अभी' : 'Now'}
                  </span>
                )}
                {!isNow && (showCleanTag || showWorstTag) && (
                  <span className="absolute -top-6 left-0 text-xs font-semibold whitespace-nowrap text-white">
                    {showCleanTag
                      ? category === 'Good'
                        ? hi
                          ? '✓ स्वच्छ'
                          : '✓ Clean'
                        : hi
                          ? '✓ कम'
                          : '✓ Low'
                      : hi
                        ? '! उच्च'
                        : '! Peak'}
                  </span>
                )}
                <span className="flex-1 w-full flex items-end px-[1px]">
                  <span
                    className={`w-full rounded-t-md transition-transform duration-150 origin-bottom ${
                      isSelected
                        ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-950'
                        : ''
                    }`}
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: barColor,
                      opacity: isSelected ? 1 : inClean || inWorst ? 0.88 : 0.62,
                      border: isNow
                        ? '2px solid #ffffff'
                        : inClean
                          ? '1px solid rgba(255,255,255,0.75)'
                          : '1px solid rgba(255,255,255,0.2)',
                    }}
                  />
                </span>
                <span
                  className={`h-5 leading-5 text-xs font-mono-tabular mt-1 ${
                    isSelected ? 'text-white font-semibold' : 'text-slate-300'
                  }`}
                >
                  {idx % 4 === 0 ? pt.hourLabel.slice(0, 2) : '\u00A0'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Live scrubbed hour readout + ARIA live announcer */}
        <div
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/15 text-xs text-slate-200"
        >
          <span className="font-mono-tabular font-semibold text-white">
            {dayLabelText(activePoint.dayLabel, hi)} · {activePoint.hourLabel}{' '}
            {activePoint.isCurrentHour ? (hi ? '(अभी)' : 'IST (Now)') : hi ? '' : 'IST'}
          </span>
          <div className="flex flex-wrap items-center gap-3 font-mono-tabular">
            <span>
              {hi ? 'वायु सूचकांक' : 'NAQI'}{' '}
              <strong className="text-white">
                {scrubbed?.aqi ?? activePoint.naqi ?? '—'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              PM2.5{' '}
              <strong className="text-white">
                {scrubbed?.pm25 ?? activePoint.pm2_5 ?? '—'}
              </strong>{' '}
              µg/m³
            </span>
            <span aria-hidden="true">·</span>
            <span>
              PM10{' '}
              <strong className="text-white">
                {scrubbed?.pm10 ?? activePoint.pm10 ?? '—'}
              </strong>{' '}
              µg/m³
            </span>
          </div>
          <span className="sr-only">{announcement}</span>
        </div>
      </section>
    );
  }
);

TimeScrubber.displayName = 'TimeScrubber';
