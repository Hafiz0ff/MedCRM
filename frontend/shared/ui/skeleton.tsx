'use client';

export function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`skeleton ${className ?? ''}`}
      style={{ width: width ?? '100%', height: height ?? '1rem' }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <Skeleton height="1.25rem" width="60%" />
      <Skeleton height="0.875rem" width="80%" />
      <Skeleton height="0.875rem" width="40%" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-table">
      <Skeleton height="2rem" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height="2.5rem" />
      ))}
    </div>
  );
}
