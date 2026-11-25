import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Check,
  ChevronDown,
  Compass,
  Home,
  Info,
  Shield,
  Sparkles,
  TrainFront,
  Users,
} from 'lucide-react';
import {
  buildActionId,
  type PlanProgress,
  triggerHapticTap,
} from '../lib/advice/progress';
import { MEDICAL_DISCLAIMER } from '../lib/shared/domain';
import type { AdviceResponse, Language, ThemeTokens } from '../types';

interface AdviceSectionProps {
  advice: AdviceResponse | null;
  loading: boolean;
  revealStage: number;
  language: Language;
  theme: ThemeTokens;
  errorNotice: string | null;
  onRetryAdvice: () => void;
  completedIds?: string[];
  planProgress?: PlanProgress;
  onToggleDone?: (actionId: string) => void;
}

interface WhyExpanderProps {
  id: string;
  why: string;
  language: Language;
  open: boolean;
  onToggle: () => void;
}

const WhyExpander: React.FC<WhyExpanderProps> = ({
  id,
  why,
  language,
  open,
  onToggle,
}) => {
  const hi = language === 'hi';

  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="min-h-[44px] px-3 py-1.5 -ml-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{hi ? 'यह सलाह क्यों?' : 'Why this?'}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      <div className="vm-disclosure-grid" data-open={open ? 'true' : 'false'}>
        <div className="vm-disclosure-inner">
          <p
            id={id}
            className="mt-1.5 text-xs text-slate-100 leading-relaxed bg-slate-950/60 border border-white/15 rounded-xl p-3"
          >
            {why}
          </p>
        </div>
      </div>
    </div>
  );
};

interface ActionRowProps {
  actionId: string;
  sectionIcon: React.ReactNode;
  action: string;
  chip?: string;
  why: string;
  done: boolean;
  language: Language;
  theme: ThemeTokens;
  onToggleDone?: (actionId: string) => void;
}

const ActionRow: React.FC<ActionRowProps> = ({
  actionId,
  sectionIcon,
  action,
  chip,
  why,
  done,
  language,
  theme,
  onToggleDone,
}) => {
  const [whyOpen, setWhyOpen] = useState(false);
  const hi = language === 'hi';

  return (
    <li
      className={`rounded-2xl transition-all duration-200 ${
        whyOpen ? 'bg-white/[0.06] ring-1 ring-white/30 p-3 -mx-2' : 'py-1'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-xl bg-slate-950/55 border border-white/15 flex items-center justify-center shrink-0 mt-0.5"
          style={{ color: theme.accent }}
          aria-hidden="true"
        >
          {sectionIcon}
        </span>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-snug transition-colors ${
              done ? 'line-through text-slate-300' : 'text-white'
            }`}
          >
            {action}
          </p>
          {chip && (
            <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/15 text-xs font-mono-tabular text-slate-200">
              {chip}
            </span>
          )}
          <WhyExpander
            id={`why-${actionId}`}
            why={why}
            language={language}
            open={whyOpen}
            onToggle={() => {
              triggerHapticTap(8);
              setWhyOpen((prev) => !prev);
            }}
          />
        </div>

        {onToggleDone && (
          <button
            type="button"
            aria-pressed={done}
            aria-label={
              done
                ? hi
                  ? 'कार्य पूर्ण चिह्नित (हटाने के लिए टैप करें)'
                  : 'Marked done (tap to undo)'
                : hi
                  ? 'कार्य पूर्ण चिह्नित करें'
                  : 'Mark action done'
            }
            onClick={() => {
              triggerHapticTap(12);
              onToggleDone(actionId);
            }}
            className={`min-h-[44px] min-w-[44px] rounded-xl border inline-flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              done
                ? 'border-transparent text-slate-950'
                : 'bg-slate-950/50 border-white/25 text-slate-200 hover:bg-white/15 hover:text-white'
            }`}
            style={
              done
                ? {
                    backgroundColor: theme.accent,
                    color: theme.accentContrast,
                  }
                : undefined
            }
          >
            <Check className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
};

export const VerdictSkeleton: React.FC<{ language: Language }> = ({ language }) => {
  const hi = language === 'hi';
  return (
    <div
      className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-3.5"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <Sparkles className="w-4 h-4 animate-pulse" aria-hidden="true" />
        <span>
          {hi
            ? 'आपके परिवार और लाइव मौसम के अनुसार सलाह तैयार हो रही है...'
            : 'Thinking through personalized household guidance from live readings...'}
        </span>
      </div>
      <div className="h-6 w-3/4 rounded-xl vm-shimmer" />
      <div className="h-4 w-full rounded-lg vm-shimmer" />
      <div className="h-4 w-2/3 rounded-lg vm-shimmer" />
    </div>
  );
};

/**
 * Compact circular SVG progress ring showing completed vs total daily actions.
 */
const PlanProgressRing: React.FC<{
  progress: PlanProgress;
  theme: ThemeTokens;
  language: Language;
}> = ({ progress, theme, language }) => {
  const hi = language === 'hi';
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress.pct / 100);

  return (
    <div
      className="vm-glass-card rounded-[24px] px-5 py-4 flex items-center justify-between gap-4"
      data-testid="todays-plan-progress"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
            className="w-11 h-11 -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="22"
              cy="22"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="4"
            />
            <circle
              cx="22"
              cy="22"
              r={r}
              fill="none"
              stroke={theme.accent}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 280ms ease' }}
            />
          </svg>
          <span className="absolute text-xs font-mono-tabular font-semibold text-white">
            {progress.completed}
          </span>
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">
            {hi ? 'आज की कार्य योजना' : "Today's plan"}
          </div>
          <div className="text-xs text-slate-200 mt-0.5">
            {hi
              ? `${progress.total} में से ${progress.completed} कदम पूरे (${progress.pct}%)`
              : `${progress.completed} of ${progress.total} actions completed (${progress.pct}%)`}
          </div>
        </div>
      </div>

      <span className="font-mono-tabular text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-950/60 border border-white/15 text-slate-100 shrink-0">
        {progress.completed}/{progress.total}
      </span>
    </div>
  );
};

/**
 * Today's Verdict & Mask Guidance card rendered below the Time Scrubber / Hero.
 */
export const VerdictAndMaskCard: React.FC<{
  advice: AdviceResponse | null;
  loading: boolean;
  revealStage: number;
  language: Language;
  theme: ThemeTokens;
  errorNotice: string | null;
  onRetryAdvice: () => void;
}> = ({ advice, loading, revealStage, language, theme, errorNotice, onRetryAdvice }) => {
  const hi = language === 'hi';
  const prefersReducedMotion = useReducedMotion();
  const [maskWhyOpen, setMaskWhyOpen] = useState(false);

  if (loading && !advice) {
    return <VerdictSkeleton language={language} />;
  }

  if (!advice) return null;

  const sourceText =
    advice.source === 'gemini'
      ? hi
        ? 'Gemini द्वारा सलाह'
        : 'Advice by Gemini'
      : hi
        ? 'ऑफ़लाइन नियम-आधारित सलाह'
        : 'Offline rule-based advice';

  return (
    <div className="space-y-3">
      {errorNotice && (
        <div
          role="status"
          className="rounded-2xl bg-amber-950/75 border border-amber-300/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100"
        >
          <span>{errorNotice}</span>
          <button
            type="button"
            onClick={onRetryAdvice}
            className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {hi ? 'पुनः प्रयास करें' : 'Retry Gemini'}
          </button>
        </div>
      )}

      <motion.section
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
        animate={
          prefersReducedMotion
            ? undefined
            : revealStage >= 1
              ? { opacity: 1, y: 0 }
              : { opacity: 0.45, y: 4 }
        }
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        aria-label={
          hi ? 'आज का निष्कर्ष और मास्क मार्गदर्शन' : "Today's Verdict and Mask Guidance"
        }
        className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-200">
            {hi ? 'आज का निष्कर्ष' : "Today's Verdict"}
          </span>
          <span className="text-xs text-slate-300" data-testid="advice-source-badge">
            {sourceText}
          </span>
        </div>

        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-semibold text-white text-balance">
            {advice.verdict.headline}
          </h2>
          <p className="text-sm text-slate-200 leading-relaxed max-w-3xl">
            {advice.verdict.summary}
          </p>
        </div>

        <div
          className={`pt-4 border-t border-white/15 transition-all duration-200 ${
            maskWhyOpen
              ? 'rounded-2xl bg-white/[0.05] p-3 -mx-3 ring-1 ring-white/25'
              : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-950/65 border border-white/20"
              style={{ color: theme.accent }}
            >
              <Shield className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">
                {hi ? 'मास्क मार्गदर्शन:' : 'Mask guidance:'}{' '}
                {advice.mask.recommended
                  ? hi
                    ? `आवश्यक (${advice.mask.type})`
                    : `Recommended (${advice.mask.type})`
                  : hi
                    ? `वैकल्पिक (${advice.mask.type})`
                    : `Optional (${advice.mask.type})`}
              </div>
              <WhyExpander
                id="why-mask"
                why={advice.mask.why}
                language={language}
                open={maskWhyOpen}
                onToggle={() => {
                  triggerHapticTap(8);
                  setMaskWhyOpen((prev) => !prev);
                }}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-300 pt-2 border-t border-white/10 leading-relaxed">
          {MEDICAL_DISCLAIMER[language]}
        </p>
      </motion.section>
    </div>
  );
};

/**
 * Detailed Interactive Advice Cards (Outdoor, Indoor, Sustainable Routine, For Whom)
 * plus "Today's plan" progress ring and health disclaimer.
 */
export const AdviceCardsGrid: React.FC<
  Pick<
    AdviceSectionProps,
    | 'advice'
    | 'loading'
    | 'revealStage'
    | 'language'
    | 'theme'
    | 'completedIds'
    | 'planProgress'
    | 'onToggleDone'
  >
> = ({
  advice,
  loading,
  revealStage,
  language,
  theme,
  completedIds = [],
  planProgress,
  onToggleDone,
}) => {
  const hi = language === 'hi';
  const prefersReducedMotion = useReducedMotion();

  if (loading && !advice) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true">
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className="vm-glass-card rounded-[24px] p-5 space-y-3">
            <div className="h-5 w-1/3 rounded-lg vm-shimmer" />
            <div className="h-4 w-full rounded-lg vm-shimmer" />
            <div className="h-4 w-5/6 rounded-lg vm-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (!advice) return null;

  const doneSet = new Set(completedIds);

  const cardMotionProps = (stage: number, delaySec: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: revealStage >= stage ? { opacity: 1, y: 0 } : { opacity: 0.45, y: 8 },
          transition: {
            duration: 0.28,
            delay: delaySec,
            ease: [0.16, 1, 0.3, 1] as const,
          },
        };

  return (
    <div className="space-y-4">
      {planProgress && planProgress.total > 0 && (
        <PlanProgressRing progress={planProgress} theme={theme} language={language} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Outdoor */}
        <motion.section
          {...cardMotionProps(2, 0)}
          aria-label={hi ? 'बाहरी गतिविधियाँ' : 'Outdoor actions'}
          className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <Compass
              className="w-5 h-5"
              style={{ color: theme.accent }}
              aria-hidden="true"
            />
            <h3 className="font-display text-base font-semibold text-white">
              {hi ? 'बाहरी गतिविधियाँ' : 'Outdoor'}
            </h3>
          </div>
          <ul className="space-y-3 divide-y divide-white/10">
            {advice.outdoor.map((item, idx) => {
              const id = buildActionId('outdoor', idx);
              return (
                <ActionRow
                  key={id}
                  actionId={id}
                  sectionIcon={<Compass className="w-4 h-4" />}
                  action={item.action}
                  chip={
                    item.timeWindow
                      ? `${hi ? 'समय:' : 'Window:'} ${item.timeWindow}`
                      : undefined
                  }
                  why={item.why}
                  done={doneSet.has(id)}
                  language={language}
                  theme={theme}
                  onToggleDone={onToggleDone}
                />
              );
            })}
          </ul>
        </motion.section>

        {/* Indoor */}
        <motion.section
          {...cardMotionProps(2, 0.06)}
          aria-label={hi ? 'घर के अंदर की हवा' : 'Indoor air actions'}
          className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <Home
              className="w-5 h-5"
              style={{ color: theme.accent }}
              aria-hidden="true"
            />
            <h3 className="font-display text-base font-semibold text-white">
              {hi ? 'घर के अंदर' : 'Indoor'}
            </h3>
          </div>
          <ul className="space-y-3 divide-y divide-white/10">
            {advice.indoor.map((item, idx) => {
              const id = buildActionId('indoor', idx);
              return (
                <ActionRow
                  key={id}
                  actionId={id}
                  sectionIcon={<Home className="w-4 h-4" />}
                  action={item.action}
                  chip={
                    item.timeWindow
                      ? `${hi ? 'समय:' : 'Window:'} ${item.timeWindow}`
                      : undefined
                  }
                  why={item.why}
                  done={doneSet.has(id)}
                  language={language}
                  theme={theme}
                  onToggleDone={onToggleDone}
                />
              );
            })}
          </ul>
        </motion.section>

        {/* Sustainable Routine */}
        <motion.section
          {...cardMotionProps(3, 0.12)}
          aria-label={hi ? 'टिकाऊ दिनचर्या और यात्रा' : 'Sustainable Routine'}
          className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <TrainFront
              className="w-5 h-5"
              style={{ color: theme.accent }}
              aria-hidden="true"
            />
            <h3 className="font-display text-base font-semibold text-white">
              {hi ? 'टिकाऊ दिनचर्या और यात्रा' : 'Sustainable Routine'}
            </h3>
          </div>
          <ul className="space-y-3 divide-y divide-white/10">
            {advice.routine.map((item, idx) => {
              const id = buildActionId('routine', idx);
              return (
                <ActionRow
                  key={id}
                  actionId={id}
                  sectionIcon={<TrainFront className="w-4 h-4" />}
                  action={item.action}
                  chip={item.co2Benefit || undefined}
                  why={item.why}
                  done={doneSet.has(id)}
                  language={language}
                  theme={theme}
                  onToggleDone={onToggleDone}
                />
              );
            })}
          </ul>
        </motion.section>

        {/* For Whom */}
        <motion.section
          {...cardMotionProps(4, 0.18)}
          aria-label={hi ? 'किसके लिए विशेष ध्यान' : 'For Whom'}
          className="vm-glass-card rounded-[24px] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <Users
              className="w-5 h-5"
              style={{ color: theme.accent }}
              aria-hidden="true"
            />
            <h3 className="font-display text-base font-semibold text-white">
              {hi ? 'किसके लिए विशेष ध्यान' : 'For Whom'}
            </h3>
          </div>
          <ul className="space-y-3 divide-y divide-white/10">
            {advice.forWhom.map((entry, idx) => (
              <li key={idx} className={idx > 0 ? 'pt-3' : ''}>
                <div className="text-xs font-semibold text-slate-300">{entry.group}</div>
                <p className="text-sm text-white mt-0.5 leading-snug">{entry.advice}</p>
              </li>
            ))}
          </ul>
        </motion.section>
      </div>

      {/* Health Disclaimer */}
      <p className="text-xs text-slate-300 px-1 leading-relaxed">{advice.disclaimer}</p>
    </div>
  );
};
