import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  /** Optional secondary line (smaller text) */
  description?: string;
}

interface Props {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** Additional CSS classes for the trigger button */
  className?: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  emptyMessage = 'Nenhum resultado encontrado',
  required,
  disabled,
  id,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = normalize(search);
    return options.filter(o =>
      normalize(o.label).includes(q) ||
      (o.description && normalize(o.description).includes(q))
    );
  }, [options, search]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setHighlightedIndex(0);
    }
  }, [open]);

  // Reset highlight when filtered changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  function handleSelect(opt: SearchableOption) {
    onChange(opt.value);
    setOpen(false);
    setSearch('');
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setSearch('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlightedIndex];
      if (opt) handleSelect(opt);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden native input for `required` validation */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value}
          onChange={() => {}}
          aria-hidden="true"
          className="sr-only"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
        />
      )}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={handleKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected?.label ?? placeholder}
        </span>
        {value && !disabled && (
          <span
            role="button"
            aria-label="Limpar seleção"
            onClick={e => {
              e.stopPropagation();
              onChange('');
            }}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Buscar..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-gray-500 text-center">{emptyMessage}</li>
            ) : (
              filtered.map((opt, i) => {
                const isHighlighted = i === highlightedIndex;
                const isSelected = opt.value === value;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${
                      isHighlighted ? 'bg-blue-50' : ''
                    } ${isSelected ? 'font-medium text-blue-700' : 'text-gray-900'}`}
                  >
                    <span className="flex-1 min-w-0">
                      <div className="truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="text-xs text-gray-500 truncate">{opt.description}</div>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
