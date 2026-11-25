import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { APP_CONFIG } from '../lib/config';
import { searchIndianCities } from '../lib/api/openMeteo';
import type { CityLocation, Language } from '../types';

interface CitySearchProps {
  selectedCity: CityLocation;
  language: Language;
  onSelectCity: (city: CityLocation) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const CitySearch: React.FC<CitySearchProps> = ({
  selectedCity,
  language,
  onSelectCity,
  inputRef,
}) => {
  const hi = language === 'hi';
  const listboxId = useId();
  const inputId = useId();
  const errorId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CityLocation[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await searchIndianCities(trimmed, controller.signal);
        setResults(items);
        setOpen(true);
        setActiveIndex(items.length > 0 ? 0 : -1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(hi ? 'शहर खोजने में समस्या आई।' : 'Unable to search cities right now.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, hi]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function commitSelection(city: CityLocation) {
    onSelectCity(city);
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      const selected = results[activeIndex];
      if (selected) {
        e.preventDefault();
        commitSelection(selected);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={inputId}
        className="block text-xs font-medium text-slate-300 mb-1.5"
      >
        {hi ? 'भारतीय शहर चुनें' : 'Indian city'}
      </label>

      <div className="relative flex items-center">
        <Search
          className="w-4 h-4 text-slate-300 absolute left-3.5 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          maxLength={APP_CONFIG.maxCityNameLength}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            if (val.trim().length >= 2) {
              setOpen(true);
            } else {
              setResults([]);
              setLoading(false);
              setError(null);
            }
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedCity.admin1
              ? `${selectedCity.name}, ${selectedCity.admin1}`
              : selectedCity.name
          }
          className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/55 border border-white/20 text-sm text-white placeholder:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-colors"
        />
        {loading ? (
          <Loader2
            className="w-4 h-4 text-slate-300 animate-spin absolute right-3.5"
            aria-label={hi ? 'खोज रहा है' : 'Searching cities'}
          />
        ) : query.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
            aria-label={hi ? 'खोज साफ़ करें' : 'Clear city search'}
            className="absolute right-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {open && (query.trim().length >= 2 || error) && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={hi ? 'शहर सुझाव' : 'City suggestions'}
          className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden"
        >
          {error ? (
            <div id={errorId} role="alert" className="px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-4 py-3 text-xs text-slate-300">
              {hi ? 'कोई भारतीय शहर नहीं मिला।' : 'No matching Indian cities found.'}
            </div>
          ) : (
            results.map((city, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={city.id}
                  id={`${listboxId}-opt-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => commitSelection(city)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center gap-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <MapPin
                    className="w-4 h-4 shrink-0 text-slate-300"
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium">{city.name}</span>
                  {city.admin1 && (
                    <span className="text-xs text-slate-400 truncate">{city.admin1}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
