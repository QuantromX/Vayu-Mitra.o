import React, { useEffect, useId, useRef, useState } from 'react';
import { Camera, Loader2, ShieldCheck, Trash2, Wind } from 'lucide-react';
import { APP_CONFIG } from '../lib/config';
import { MEDICAL_DISCLAIMER } from '../lib/shared/domain';
import {
  stripExifFromImage,
  validatePhotoFile,
  type StrippedPhotoPayload,
} from '../lib/vision/exifStrip';
import type {
  NaqiResult,
  PhotoCheckConfidence,
  PhotoCheckResponse,
  PhotoSceneHint,
  ThemeTokens,
  UserProfile,
} from '../types';

interface PhotoCheckCardProps {
  profile: UserProfile;
  naqi: NaqiResult | null;
  theme: ThemeTokens;
}

function confidenceLabel(confidence: PhotoCheckConfidence, hi: boolean): string {
  if (confidence === 'high') return hi ? 'विश्वसनीयता: उच्च' : 'Confidence: High';
  if (confidence === 'medium') return hi ? 'विश्वसनीयता: मध्यम' : 'Confidence: Medium';
  return hi ? 'विश्वसनीयता: सीमित' : 'Confidence: Low';
}

/**
 * Gemini Vision Photo Check card: accepts JPEG/PNG/WebP up to 4 MB, strips all EXIF
 * metadata locally in the browser before upload, and displays visual ventilation & purifier cues.
 */
const PhotoCheckCard: React.FC<PhotoCheckCardProps> = ({ profile, naqi, theme }) => {
  const hi = profile.language === 'hi';
  const fileInputId = useId();
  const errorId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sceneHint, setSceneHint] = useState<PhotoSceneHint>('auto');
  const [stripped, setStripped] = useState<StrippedPhotoPayload | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoCheckResponse | null>(null);

  useEffect(() => {
    return () => {
      if (stripped?.previewUrl) {
        URL.revokeObjectURL(stripped.previewUrl);
      }
    };
  }, [stripped]);

  const handleClear = () => {
    if (stripped?.previewUrl) {
      URL.revokeObjectURL(stripped.previewUrl);
    }
    setStripped(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);

    const check = validatePhotoFile(file);
    if (!check.valid) {
      setError(hi ? (check.errorHi ?? 'अमान्य फ़ोटो') : (check.errorEn ?? 'Invalid image'));
      e.target.value = '';
      return;
    }

    setPreparing(true);
    try {
      const clean = await stripExifFromImage(file);
      if (stripped?.previewUrl) {
        URL.revokeObjectURL(stripped.previewUrl);
      }
      setStripped(clean);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : hi
            ? 'फ़ोटो प्रोसेस करने में समस्या हुई।'
            : 'Could not prepare image locally.'
      );
    } finally {
      setPreparing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!stripped || analyzing) return;
    setAnalyzing(true);
    setError(null);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), APP_CONFIG.geminiTimeoutMs);

    try {
      const response = await fetch('/api/photo-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          mimeType: stripped.mimeType,
          imageBase64: stripped.imageBase64,
          sceneHint,
          aqi: naqi?.aqi,
          category: naqi?.category,
          hasPurifier: profile.hasPurifier,
          language: profile.language,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          body.error ||
            (hi
              ? `फ़ोटो जांच विफल (HTTP ${response.status})`
              : `Photo check failed (HTTP ${response.status})`)
        );
      }

      const data = (await response.json()) as PhotoCheckResponse;
      setResult(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError(
          hi
            ? 'फ़ोटो जांच में समय सीमा समाप्त हो गई — कृपया पुनः प्रयास करें।'
            : 'Photo inspection timed out — please retry.'
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : hi
              ? 'फ़ोटो विश्लेषण पूरा नहीं हो सका।'
              : 'Could not complete photo check.'
        );
      }
    } finally {
      window.clearTimeout(timer);
      setAnalyzing(false);
    }
  };

  return (
    <section
      aria-label={hi ? 'फ़ोटो जांच — कमरा या आसमान' : 'Photo Check — Room or Sky'}
      className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Camera
            className="w-5 h-5 shrink-0"
            style={{ color: theme.accent }}
            aria-hidden="true"
          />
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {hi ? 'फ़ोटो जांच (कमरा या आसमान)' : 'Photo Check (Room or Sky)'}
            </h2>
            <p className="text-xs text-slate-300">
              {hi
                ? 'प्यूरीफायर रखने की जगह, वेंटिलेशन या बाहरी धुंध का परामर्श अनुमान — यह सेंसर माप नहीं है।'
                : 'Visual advisory cues for purifier placement, ventilation, or sky haze — not an air sensor measurement.'}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/15 text-xs text-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
          <span>
            {hi
              ? 'EXIF डेटा ब्राउज़र में हटता है · फ़ोटो सेव नहीं होती'
              : 'EXIF stripped locally · Never stored'}
          </span>
        </span>
      </div>

      {/* Scene hint + file picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="group"
          aria-label={hi ? 'फ़ोटो दृश्य प्रकार' : 'Photo scene type'}
          className="inline-flex p-1 rounded-xl bg-slate-950/60 border border-white/15 self-start"
        >
          {(
            [
              { id: 'auto', en: 'Auto', hi: 'स्वतः' },
              { id: 'room', en: 'Room', hi: 'कमरा' },
              { id: 'sky', en: 'Sky', hi: 'आसमान' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={sceneHint === opt.id}
              onClick={() => setSceneHint(opt.id)}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                sceneHint === opt.id
                  ? 'bg-white text-slate-950'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              {hi ? opt.hi : opt.en}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={fileInputId}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-950/70 border border-white/25 text-xs font-semibold text-white hover:bg-white/15 inline-flex items-center gap-2 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-white"
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
            <span>
              {preparing
                ? hi
                  ? 'EXIF हटाया जा रहा है...'
                  : 'Stripping EXIF...'
                : hi
                  ? 'फ़ोटो चुनें / खींचें (≤ 4 MB)'
                  : 'Upload or take photo (≤ 4 MB)'}
            </span>
          </label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => void handleFileChange(e)}
            className="sr-only"
          />

          {stripped && (
            <>
              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={analyzing}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold inline-flex items-center gap-2 hover:bg-slate-100 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {analyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Wind className="w-4 h-4" aria-hidden="true" />
                )}
                <span>
                  {analyzing
                    ? hi
                      ? 'जांच हो रही है...'
                      : 'Analyzing...'
                    : hi
                      ? 'फ़ोटो जांचें'
                      : 'Check photo'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                aria-label={hi ? 'फ़ोटो हटाएँ' : 'Clear selected photo'}
                className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-slate-950/60 border border-white/20 text-slate-200 hover:text-white hover:bg-white/15 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stripped preview + privacy summary */}
      {stripped && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl bg-slate-950/55 border border-white/15 p-3">
          <img
            src={stripped.previewUrl}
            width={96}
            height={96}
            alt={
              hi
                ? 'EXIF-मुक्त अपलोड की गई फ़ोटो का पूर्वावलोकन'
                : 'Preview of locally EXIF-stripped photo'
            }
            className="w-24 h-24 object-cover rounded-xl border border-white/20 shrink-0"
          />
          <div className="space-y-1 text-xs text-slate-200">
            <div className="font-semibold text-white">
              {hi
                ? 'जांच के लिए तैयार (EXIF और लोकेशन टैग हटा दिए गए)'
                : 'Ready to inspect (EXIF & GPS metadata stripped locally)'}
            </div>
            <div className="font-mono-tabular text-slate-300">
              {stripped.mimeType} · {Math.max(1, Math.round(stripped.byteSize / 1024))} KB
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-300">{MEDICAL_DISCLAIMER[profile.language]}</p>

      {/* Status and structured output */}
      <div aria-live="polite" className="space-y-3">
        {error && (
          <div
            id={errorId}
            role="alert"
            className="rounded-xl bg-rose-950/75 border border-rose-300/35 px-4 py-3 text-xs text-rose-100"
          >
            {error}
          </div>
        )}

        {result && (
          <div
            data-testid="photo-check-result"
            className="rounded-2xl bg-slate-950/65 border border-white/20 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-white/15 border border-white/20 text-xs font-semibold text-white">
                {confidenceLabel(result.confidence, hi)}
              </span>
              <span className="text-xs text-slate-300">
                {result.source === 'gemini'
                  ? hi
                    ? 'Gemini Vision द्वारा'
                    : 'Gemini Vision'
                  : hi
                    ? 'ऑफ़लाइन परामर्श'
                    : 'Offline advisory fallback'}
              </span>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-200 mb-1.5">
                {hi ? 'दृश्य अवलोकन' : 'Visual observations'}
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-white">
                {result.observations.map((obs, idx) => (
                  <li key={idx}>{obs}</li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="text-xs font-semibold text-slate-200 mb-1">
                  {hi ? 'प्यूरीफायर / कमरा सुझाव' : 'Purifier / room placement'}
                </div>
                <p className="text-xs text-slate-100 leading-relaxed">
                  {result.purifierPlacement}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="text-xs font-semibold text-slate-200 mb-1">
                  {hi ? 'वेंटिलेशन सुझाव' : 'Ventilation guidance'}
                </div>
                <p className="text-xs text-slate-100 leading-relaxed">
                  {result.ventilationTip}
                </p>
              </div>
            </div>

            <p className="text-xs text-amber-200 leading-relaxed">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default React.memo(PhotoCheckCard);
