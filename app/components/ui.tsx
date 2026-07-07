import Link from 'next/link';
import type { ReactNode } from 'react';

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
};

export function ButtonLink({ href, children, variant = 'primary' }: ButtonLinkProps) {
  const className = variant === 'primary'
    ? 'rounded-full bg-[var(--scarlet)] px-7 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_45px_var(--scarlet-shadow)] transition hover:bg-[var(--scarlet-dark)]'
    : 'rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-[var(--foreground)] transition hover:border-[var(--foreground)] hover:bg-[var(--surface-strong)]';

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function SurfaceCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`surface-card ${className}`}>{children}</div>;
}
