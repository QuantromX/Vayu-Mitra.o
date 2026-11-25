import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Thermometer, Wind, X } from 'lucide-react';
import type { Language, ScrubbedHourState, ThemeTokens } from '../types';
import { CATEGORY_HINDI } from './HeroReadout';

interface HourlyDetailsSheetProps {
  open: boolean;
  scrubbed: ScrubbedHourState | null;
  totalHours: number;
  theme: ThemeTokens;
  language: Language;
  onClose: () => void;
  onStepHour: (delta: number) => void;
}

/**
 * Accessible bottom sheet displaying full hourly telemetry (PM2.5, PM10, temperature, wind).
 * Supports drag handle swipe-to-close, ESC key, backdrop tap, and focus trapping.
 */
const HourlyDetailsSheet: React.FC<HourlyDetailsSheetProps> = ({
  open,
  scrubbed,
  totalHours,
  theme,
  language,
  onClose,
  onStepHour,
}) => {
  const hi = language === 'hi';
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusables = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !scrubbed) return null;

  const dayWord = hi ? (scrubbed.dayLabel === 'Today' ? 'आज' : 'कल') : scrubbed.dayLabel;
  const catLabel = hi ? CATEGORY_HINDI[scrubbed.category] : scrubbed.category;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={hi ? 'प्रति घंटा वायु विवरण' : 'Hourly air quality details'}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          dragStartYRef.current = e.clientY;
        }}
        onPointerMove={(e) => {
          if (dragStartYRef.current === null) return;
          const delta = Math.max(0, e.clientY - dragStartYRef.current);
          setDragOffsetY(delta);
        }}
        onPointerUp={() => {
          if (dragOffsetY > 90) {
            setDragOffsetY(0);
            dragStartYRef.current = null;
            onClose();
            return;
          }
          setDragOffsetY(0);
          dragStartYRef.current = null;
        }}
        style={{ transform: `translate3d(0, ${dragOffsetY}px, 0)` }}
        className="w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] bg-slate-950/95 border border-white/20 p-5 sm:p-6 shadow-2xl space-y-5"
      >
        {/* Drag handle */}
        <div
          className="w-12 h-1.5 rounded-full bg-white/30 mx-auto sm:hidden"
          aria-hidden="true"
        />

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-300">
              {hi ? 'प्रति घंटा विवरण' : 'Hourly inspection'}
            </div>
            <h2 className="font-display text-xl font-semibold text-white mt-0.5">
              {dayWord} · {scrubbed.hourLabel} IST
              {scrubbed.isLive ? (hi ? ' (अभी)' : ' (Now)') : ''}
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={hi ? 'विवरण बंद करें' : 'Close hourly details'}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/15 p-4">
          <div>
            <div className="text-xs text-slate-300">
              {hi ? 'वायु सूचकांक' : 'India NAQI estimate'}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display text-4xl font-light tabular-nums text-white">
                {scrubbed.aqi}
              </span>
              <span className="text-sm font-semibold" style={{ color: theme.accent }}>
                {catLabel}
              </span>
            </div>
          </div>

          <span
            className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{
              backgroundColor: theme.accent,
              color: theme.accentContrast,
            }}
          >
            {scrubbed.verdictLabel}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
            <dt className="text-xs text-slate-300">PM2.5</dt>
            <dd className="font-mono-tabular text-lg font-semibold text-white mt-1">
              {scrubbed.pm25}{' '}
              <span className="text-xs font-normal text-slate-300">µg/m³</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
            <dt className="text-xs text-slate-300">PM10</dt>
            <dd className="font-mono-tabular text-lg font-semibold text-white mt-1">
              {scrubbed.pm10}{' '}
              <span className="text-xs font-normal text-slate-300">µg/m³</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
            <dt className="text-xs text-slate-300 inline-flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{hi ? 'तापमान' : 'Temperature'}</span>
            </dt>
            <dd className="font-mono-tabular text-lg font-semibold text-white mt-1">
              {scrubbed.temperatureC}°C
            </dd>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
            <dt className="text-xs text-slate-300 inline-flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{hi ? 'हवा की गति' : 'Wind speed'}</span>
            </dt>
            <dd className="font-mono-tabular text-lg font-semibold text-white mt-1">
              {scrubbed.windSpeedKmh}{' '}
              <span className="text-xs font-normal text-slate-300">km/h</span>
            </dd>
          </div>
        </dl>

        <p className="text-xs text-slate-200 leading-relaxed">{scrubbed.verdictLine}</p>

        {/* Hour stepping inside sheet */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/15">
          <button
            type="button"
            disabled={scrubbed.index <= 0}
            onClick={() => onStepHour(-1)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-medium text-white inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span>{hi ? 'पिछला घंटा' : 'Prev hour'}</span>
          </button>

          <button
            type="button"
            disabled={scrubbed.index >= totalHours - 1}
            onClick={() => onStepHour(1)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-medium text-white inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>{hi ? 'अगला घंटा' : 'Next hour'}</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(HourlyDetailsSheet);
