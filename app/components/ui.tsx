import Link from 'next/link';
import type { ReactNode } from 'react';

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
};

export function ButtonLink({ href, children, variant = 'primary' }: ButtonLinkProps) {
  const className = variant === 'primary'
    ? 'rounded-full bg-[var(--scarlet)] px-7 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_45px_var(--scarlet-shadow)] transition hover:bg-[var(--scarlet-dark)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--scarlet)]'
    : 'rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-[var(--foreground)] transition hover:border-[var(--foreground)] hover:bg-[var(--surface-strong)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--scarlet)]';

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function SurfaceCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`surface-card ${className}`}>{children}</div>;
}

export type DataHealthProps = {
  updatedAt?: string | null;
  stale?: boolean;
  source?: string;
  providers?: Record<string, string>;
  freshness?: { cached?: boolean; stale?: boolean; source?: string; dataUpdatedAt?: string; sourceState?: string };
  sourceHealth?: Record<string, string | { state?: string; stale?: boolean }>;
  label?: string;
};

export function DataHealth({ updatedAt, stale = false, source, providers, freshness, sourceHealth, label = 'Data' }: DataHealthProps) {
  const effectiveStale = stale || Boolean(freshness?.stale) || Object.values(sourceHealth || {}).some((health) => typeof health === 'object' && health.stale);
  const effectiveSource = source || freshness?.source;
  const providerStates = Object.values(sourceHealth || {}).map((health) => typeof health === 'string' ? health : health.state);
  const unavailable = freshness?.sourceState === 'unavailable' || providerStates.some((state) => ['error', 'timeout', 'unavailable', 'invalid'].includes(state || ''));
  const parsed = (updatedAt || freshness?.dataUpdatedAt) ? new Date(updatedAt || freshness?.dataUpdatedAt || '') : null;
  const hasDate = parsed && !Number.isNaN(parsed.getTime());
  const unhealthy = Object.values(providers || {}).some((state) => ['error', 'timeout', 'unavailable', 'invalid'].includes(state));
  const message = unavailable
    ? `${label} unavailable`
    : effectiveStale
      ? `${label} may be outdated`
    : hasDate
      ? `${label} ${freshness?.cached ? 'fresh cache' : 'fresh'} · updated ${parsed.toLocaleString()}`
      : `${label} freshness unavailable`;

  return (
    <div className={`data-health ${unavailable || unhealthy ? 'data-health-warning' : effectiveStale ? 'data-health-stale' : 'data-health-fresh'}`}>
      <span className="data-health-dot" aria-hidden="true" />
      <span>{message}</span>
      {effectiveStale && hasDate ? <span>· data from {parsed.toLocaleString()}</span> : null}
      {effectiveSource ? <span className="data-health-source">via {effectiveSource}</span> : null}
      {unhealthy && !unavailable ? <span>· Some sources unavailable</span> : null}
    </div>
  );
}
