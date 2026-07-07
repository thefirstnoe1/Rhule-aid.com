'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ThemeToggle } from './theme-toggle';

const navItems = [
  { label: 'Schedule', href: '/schedule' },
  { label: 'CFB Schedule', href: '/cfb-schedule' },
  { label: 'Game Day', href: '/gameday' },
  { label: 'Roster', href: '/roster' },
  { label: 'News', href: '/news' },
  { label: 'Coach Rhule', href: '/rhule-aid' }
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="container-shell sticky top-4 z-40 py-4">
      <div className="surface-card rounded-[1.5rem] px-4 py-3 md:rounded-full md:px-5">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 no-underline" onClick={() => setOpen(false)}>
            <Image
              src="/images/logos/nebraska-logo.png"
              alt="Nebraska N logo"
              width={42}
              height={42}
              priority
              className="h-10 w-10 object-contain"
            />
            <span className="text-lg font-black tracking-[-0.035em]">Rhule Aid</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-bold text-[var(--muted)] md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-full px-4 py-2 transition hover:bg-[var(--foreground)] hover:text-[var(--background)]">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-black md:hidden"
              aria-expanded={open}
              aria-label="Toggle navigation"
              onClick={() => setOpen((current) => !current)}
            >
              {open ? '×' : '☰'}
            </button>
          </div>
        </div>

        {open && (
          <nav className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4 text-sm font-bold text-[var(--muted)] md:hidden">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl px-4 py-3 transition hover:bg-[var(--foreground)] hover:text-[var(--background)]" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
