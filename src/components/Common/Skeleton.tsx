import { ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  /** Use circle shape (for avatars) */
  circle?: boolean;
  /** Width — string with unit (e.g., '100%', '200px') */
  width?: string | number;
  /** Height — string with unit */
  height?: string | number;
}

/**
 * Base skeleton primitive — animated gray placeholder.
 *
 * Composed via the helper components below for common patterns,
 * or use directly with className for custom shapes.
 */
export function Skeleton({ className = '', circle, width, height }: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`block bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-skeleton ${
        circle ? 'rounded-full' : 'rounded-md'
      } ${className}`}
    />
  );
}

/** Loading wrapper with screen reader announcement */
export function LoadingWrapper({
  loading,
  fallback,
  children,
  label = 'Carregando...',
}: {
  loading: boolean;
  fallback: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  if (loading) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">{label}</span>
        {fallback}
      </div>
    );
  }
  return <>{children}</>;
}

/** Skeleton for table rows */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  showHeader = true,
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {showHeader && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 max-w-[120px]" />
          ))}
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-4 flex gap-4 items-center">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-4 flex-1 ${c === 0 ? 'max-w-[180px]' : 'max-w-[140px]'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for card grids */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton circle width={40} height={40} />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for list items */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3"
        >
          <Skeleton circle width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for stat cards (dashboard tiles) */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Page-level loading state with header */
export function PageSkeleton({
  title,
  showStats = false,
  variant = 'table',
}: {
  title?: string;
  showStats?: boolean;
  variant?: 'table' | 'cards' | 'list';
}) {
  return (
    <div className="space-y-6">
      <div>
        {title ? (
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        ) : (
          <Skeleton className="h-7 w-64" />
        )}
        <Skeleton className="h-4 w-40 mt-2" />
      </div>
      {showStats && <StatsSkeleton />}
      {variant === 'table' && <TableSkeleton />}
      {variant === 'cards' && <CardGridSkeleton />}
      {variant === 'list' && <ListSkeleton />}
    </div>
  );
}
