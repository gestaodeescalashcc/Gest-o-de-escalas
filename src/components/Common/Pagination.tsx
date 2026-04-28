import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Visible label for items (e.g., "profissionais") */
  itemLabel?: string;
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

function buildPageRange(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(totalPages - 1, current + 1);
  if (left > 2) pages.push('ellipsis');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  itemLabel = 'itens',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startItem = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(total, safePage * pageSize);

  const pageRange = buildPageRange(safePage, totalPages);

  const goTo = (p: number) => {
    if (p === safePage) return;
    if (p < 1 || p > totalPages) return;
    onPageChange(p);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50/60">
      <div className="text-sm text-gray-600 order-2 sm:order-1">
        {total === 0 ? (
          <span>Nenhum {itemLabel.replace(/s$/, '')} encontrado</span>
        ) : (
          <span>
            Mostrando <span className="font-medium text-gray-900">{startItem}</span>
            {' – '}
            <span className="font-medium text-gray-900">{endItem}</span> de{' '}
            <span className="font-medium text-gray-900">{total}</span> {itemLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 order-1 sm:order-2">
        {onPageSizeChange && (
          <label className="hidden sm:flex items-center gap-2 text-sm text-gray-600 mr-2">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={e => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="min-h-[36px] py-1 pl-2 pr-7 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav aria-label="Paginação" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goTo(1)}
            disabled={safePage === 1}
            aria-label="Primeira página"
            className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goTo(safePage - 1)}
            disabled={safePage === 1}
            aria-label="Página anterior"
            className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <div className="hidden sm:flex items-center gap-1">
            {pageRange.map((p, idx) =>
              p === 'ellipsis' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-9 h-9 inline-flex items-center justify-center text-sm text-gray-400"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => goTo(p)}
                  aria-current={safePage === p ? 'page' : undefined}
                  aria-label={`Página ${p}`}
                  className={`min-w-[36px] h-9 px-2 inline-flex items-center justify-center text-sm rounded-md border transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    safePage === p
                      ? 'bg-blue-600 border-blue-600 text-white font-semibold shadow-sm'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <span className="sm:hidden text-sm text-gray-600 px-2">
            {safePage}/{totalPages}
          </span>

          <button
            type="button"
            onClick={() => goTo(safePage + 1)}
            disabled={safePage === totalPages}
            aria-label="Próxima página"
            className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goTo(totalPages)}
            disabled={safePage === totalPages}
            aria-label="Última página"
            className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ChevronsRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}
