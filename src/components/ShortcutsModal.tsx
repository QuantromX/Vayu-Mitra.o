import React, { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import type { Language } from '../types';

interface ShortcutsModalProps {
  open: boolean;
  language: Language;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: '/', en: 'Focus Indian city search', hi: 'शहर खोज बॉक्स पर जाएँ' },
  { key: 'R', en: 'Refresh live Open-Meteo readings', hi: 'लाइव डेटा रीफ़्रेश करें' },
  {
    key: '[ / ]',
    en: 'Scrub 24h timeline backward / forward',
    hi: '24 घंटे टाइमलाइन आगे / पीछे करें',
  },
  {
    key: '?',
    en: 'Toggle keyboard shortcuts help',
    hi: 'कीबोर्ड शॉर्टकट सहायता खोलें/बंद करें',
  },
];

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, language, onClose }) => {
  const hi = language === 'hi';
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={hi ? 'कीबोर्ड शॉर्टकट' : 'Keyboard shortcuts'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] bg-slate-950/95 border border-white/20 p-5 sm:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-slate-200" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-white">
              {hi ? 'कीबोर्ड शॉर्टकट' : 'Keyboard shortcuts'}
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={hi ? 'बंद करें' : 'Close shortcuts help'}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="space-y-2.5">
          {SHORTCUTS.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-xs"
            >
              <span className="text-slate-200">{hi ? item.hi : item.en}</span>
              <kbd className="font-mono-tabular px-2.5 py-1 rounded-lg bg-slate-900 border border-white/25 text-white font-semibold shrink-0">
                {item.key}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default React.memo(ShortcutsModal);
