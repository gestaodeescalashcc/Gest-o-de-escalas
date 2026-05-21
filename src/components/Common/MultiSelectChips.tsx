import { useState, useRef, useEffect } from 'react';
import { Plus, X, ChevronDown, Check } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

interface MultiSelectChipsProps {
  options: Option[];
  selectedIds: string[];
  primaryId?: string | null;
  onChange: (ids: string[], primaryId: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  label?: string;
  disabled?: boolean;
  /** Se true, exibe controle "primária" — radio entre os selecionados. Default true. */
  allowPrimary?: boolean;
}

export default function MultiSelectChips({
  options,
  selectedIds,
  primaryId,
  onChange,
  placeholder = 'Adicionar...',
  emptyText = 'Nenhum item selecionado',
  label,
  disabled = false,
  allowPrimary = true,
}: MultiSelectChipsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selectedOptions = selectedIds
    .map(id => options.find(o => o.id === id))
    .filter((o): o is Option => !!o);

  const availableOptions = options.filter(
    o => !selectedIds.includes(o.id) && (o.name ?? '').toLowerCase().includes(query.toLowerCase())
  );

  const addOption = (id: string) => {
    const newIds = [...selectedIds, id];
    const newPrimary = primaryId || newIds[0];
    onChange(newIds, newPrimary);
    setQuery('');
  };

  const removeOption = (id: string) => {
    const newIds = selectedIds.filter(x => x !== id);
    let newPrimary = primaryId;
    if (primaryId === id) {
      newPrimary = newIds[0] || null;
    }
    onChange(newIds, newPrimary || null);
  };

  const setPrimary = (id: string) => {
    onChange(selectedIds, id);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      <div className="border border-gray-300 rounded-lg p-2 min-h-[44px] bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition">
        {selectedOptions.length === 0 && !open && (
          <span className="text-sm text-gray-400">{emptyText}</span>
        )}

        <div className="flex flex-wrap gap-1.5 items-center">
          {selectedOptions.map(opt => {
            const isPrimary = allowPrimary && opt.id === primaryId;
            return (
              <span
                key={opt.id}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${
                  isPrimary
                    ? 'bg-blue-100 text-blue-800 ring-blue-300'
                    : 'bg-gray-100 text-gray-700 ring-gray-300'
                }`}
              >
                {allowPrimary && selectedOptions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPrimary(opt.id)}
                    title={isPrimary ? 'Esta é a categoria/setor principal' : 'Tornar principal'}
                    className={`w-3.5 h-3.5 rounded-full ring-1 flex items-center justify-center ${
                      isPrimary ? 'bg-blue-600 ring-blue-700' : 'bg-white ring-gray-400 hover:ring-blue-500'
                    }`}
                  >
                    {isPrimary && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </button>
                )}
                <span>{opt.name}</span>
                {isPrimary && <span className="text-[9px] uppercase font-bold opacity-70">Principal</span>}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeOption(opt.id)}
                    className="hover:bg-black/10 rounded-full p-0.5"
                    aria-label={`Remover ${opt.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })}

          {!disabled && (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-blue-700 hover:bg-blue-50 border border-dashed border-blue-300"
            >
              <Plus className="w-3 h-3" />
              {placeholder}
              <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar..."
            autoFocus
            className="w-full px-3 py-2 text-sm border-b border-gray-200 focus:outline-none"
          />
          {availableOptions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500 text-center">Nada encontrado</p>
          ) : (
            availableOptions.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => addOption(opt.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                {opt.name}
              </button>
            ))
          )}
        </div>
      )}

      {allowPrimary && selectedOptions.length > 1 && (
        <p className="mt-1 text-xs text-gray-500">
          Clique no círculo de uma chip para definir como <strong>principal</strong>.
        </p>
      )}
    </div>
  );
}
