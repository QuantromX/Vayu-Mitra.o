import React, { useState } from 'react';
import { ChevronDown, Database, ExternalLink, ShieldAlert } from 'lucide-react';
import type { Language, NaqiResult, ThemeTokens } from '../types';

interface DataConfidenceCardProps {
  cityName: string;
  naqi: NaqiResult | null;
  lastUpdated: Date | null;
  language: Language;
  theme: ThemeTokens;
}

/**
 * Transparent "How reliable is this?" disclosure panel explaining Open-Meteo model estimates,
 * NAQI-style rolling/current basis, IST update timestamp, differences vs nearest CPCB station,
 * and clickable HTTPS source links.
 */
export const DataConfidenceCard: React.FC<DataConfidenceCardProps> = React.memo(
  ({ cityName, naqi, lastUpdated, language, theme }) => {
    const hi = language === 'hi';
    const [open, setOpen] = useState(false);

    const updatedIst = lastUpdated
      ? `${lastUpdated.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata',
        })} IST`
      : hi
        ? 'प्रतीक्षारत'
        : 'Pending';

    return (
      <section
        aria-label={hi ? 'डेटा विश्वसनीयता जानकारी' : 'How reliable is this data'}
        className="vm-glass-card rounded-[24px] p-5 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Database
              className="w-5 h-5 shrink-0 mt-0.5"
              style={{ color: theme.accent }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-semibold text-white">
                {hi ? 'यह डेटा कितना विश्वसनीय है?' : 'How reliable is this?'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {hi
                  ? `${cityName} · Open-Meteo मॉडल अनुमान · अपडेट: ${updatedIst}`
                  : `${cityName} · Open-Meteo model estimate (not a ground sensor) · Updated ${updatedIst}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="data-confidence-toggle"
            aria-expanded={open}
            aria-controls="data-confidence-details"
            onClick={() => setOpen((prev) => !prev)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-950/65 border border-white/25 text-xs font-semibold text-white hover:bg-white/15 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>
              {open ? (hi ? 'छुपाएँ' : 'Hide details') : hi ? 'विवरण देखें' : 'Read details'}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        <div
          className="vm-disclosure-grid"
          data-open={open ? 'true' : 'false'}
          aria-hidden={!open}
          inert={!open}
        >
          <div className="vm-disclosure-inner">
            <div
              id="data-confidence-details"
              className="mt-4 pt-4 border-t border-white/15 space-y-3 text-xs text-slate-200 leading-relaxed"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-950/55 border border-white/15 p-3.5 space-y-1">
                  <div className="font-semibold text-white">
                    {hi ? '1. मॉडल-आधारित अनुमान' : '1. Model-based estimate'}
                  </div>
                  <p>
                    {hi
                      ? 'Open-Meteo CAMS/ECMWF वायुमंडलीय मॉडल पर आधारित ग्रिड अनुमान देता है — यह किसी भौतिक ग्राउंड सेंसर की लाइव रीडिंग नहीं है।'
                      : 'Open-Meteo serves gridded CAMS/ECMWF atmospheric model estimates — not a physical roadside sensor reading.'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/55 border border-white/15 p-3.5 space-y-1">
                  <div className="font-semibold text-white">
                    {hi ? '2. NAQI-शैली गणना' : '2. NAQI-style estimate'}
                  </div>
                  <p>
                    {hi
                      ? `भारत CPCB PM2.5 और PM10 ब्रेकपाइंट से ${naqi?.basis === 'rolling_24h' ? 'पिछले 24 घंटे के रोलिंग औसत' : 'वर्तमान रीडिंग'} पर गणना की गई है।`
                      : `Computed with official India CPCB PM2.5 and PM10 breakpoints using ${naqi?.basis === 'rolling_24h' ? 'rolling 24-hour averages' : 'current hourly values'}.`}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/55 border border-white/15 p-3.5 space-y-1">
                  <div className="font-semibold text-white">
                    {hi ? '3. नज़दीकी CPCB स्टेशन से अंतर' : '3. Why CPCB stations can differ'}
                  </div>
                  <p>
                    {hi
                      ? 'स्थानीय निर्माण कार्य, ट्रैफ़िक जंक्शन या कचरा जलने से नज़दीकी CPCB मॉनिटर पर संख्या अधिक हो सकती है।'
                      : 'Hyper-local traffic, construction dust, or biomass burning can push the nearest CPCB station higher than a city-grid model.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/55 border border-white/15 px-3.5 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-slate-200">
                  <ShieldAlert
                    className="w-4 h-4 text-amber-300 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {hi
                      ? `अंतिम अपडेट: ${updatedIst} · हर 10 मिनट कैश`
                      : `Last updated: ${updatedIst} · 10-minute response cache`}
                  </span>
                </span>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="https://open-meteo.com/en/docs/air-quality-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] inline-flex items-center gap-1 text-white underline underline-offset-4 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1"
                  >
                    <span>Open-Meteo Air Quality</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                  <a
                    href="https://airquality.cpcb.gov.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] inline-flex items-center gap-1 text-white underline underline-offset-4 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1"
                  >
                    <span>CPCB National AQI</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }
);

DataConfidenceCard.displayName = 'DataConfidenceCard';
