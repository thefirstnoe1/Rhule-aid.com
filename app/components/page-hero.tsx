import type { ReactNode } from 'react';

type PageHeroProps = {
  eyebrow: string;
  title: string;
  children?: ReactNode;
};

export function PageHero({ eyebrow, title, children }: PageHeroProps) {
  return (
    <section className="container-shell pb-10 pt-10 md:pt-14">
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h1 className="max-w-5xl text-5xl font-black leading-[0.9] tracking-[-0.075em] text-[var(--foreground)] sm:text-7xl">
        {title}
      </h1>
      {children ? <div className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">{children}</div> : null}
    </section>
  );
}
