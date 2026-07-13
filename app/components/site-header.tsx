'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
  const [hidden, setHidden] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const homeLinkRef = useRef<HTMLAnchorElement>(null);
  const hasOpenedMenu = useRef(false);
  const focusAfterClose = useRef<'button' | 'desktop' | null>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      setHidden(currentScrollY > 120 && currentScrollY > lastScrollY);
      lastScrollY = currentScrollY;
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (open) {
      hasOpenedMenu.current = true;
      menuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
      return;
    }

    if (hasOpenedMenu.current) {
      const target = focusAfterClose.current;
      focusAfterClose.current = null;

      if (target === 'desktop') {
        const desktopLink = desktopNavRef.current?.querySelector<HTMLAnchorElement>('a');
        (desktopLink || homeLinkRef.current)?.focus();
      } else if (target === 'button') {
        menuButtonRef.current?.focus();
      }
    }
  }, [open]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');

    function handleBreakpointChange(event: MediaQueryListEvent) {
      if (!event.matches || !open) return;

      const focusIsInMenu = menuRef.current?.contains(document.activeElement) ?? false;
      focusAfterClose.current = focusIsInMenu ? 'desktop' : null;
      setOpen(false);
    }

    mediaQuery.addEventListener('change', handleBreakpointChange);
    return () => mediaQuery.removeEventListener('change', handleBreakpointChange);
  }, [open]);

  function closeMenu() {
    focusAfterClose.current = 'button';
    setOpen(false);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && open) {
        closeMenu();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <header className={`container-shell sticky top-4 z-40 py-4 transition-transform duration-300 ${hidden && !open ? '-translate-y-28 pointer-events-none' : 'translate-y-0'}`}>
      <div className="surface-card rounded-[1.5rem] px-4 py-3 md:rounded-full md:px-5">
        <div className="flex items-center justify-between gap-4">
          <Link ref={homeLinkRef} href="/" className="flex items-center gap-3 no-underline" onClick={() => setOpen(false)}>
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

          <nav ref={desktopNavRef} className="hidden items-center gap-1 text-sm font-bold text-[var(--muted)] md:flex">
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
              ref={menuButtonRef}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-black md:hidden"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              aria-label="Toggle navigation"
              onClick={() => open ? closeMenu() : setOpen(true)}
            >
              {open ? '×' : '☰'}
            </button>
          </div>
        </div>

        {open && (
          <nav id="mobile-navigation" ref={menuRef} aria-label="Mobile navigation" className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4 text-sm font-bold text-[var(--muted)] md:hidden">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl px-4 py-3 transition hover:bg-[var(--foreground)] hover:text-[var(--background)]" onClick={closeMenu}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
