import { SurfaceCard } from '../components/ui';

export default function Loading() {
  return (
    <main>
      <section className="container-shell pb-20 pt-10" aria-busy="true" aria-label="Loading roster">
        <div className="mb-6 h-12 w-48 animate-pulse rounded-2xl bg-[var(--surface-strong)]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <SurfaceCard key={item} className="h-56 animate-pulse rounded-[1.75rem]"><span /></SurfaceCard>
          ))}
        </div>
      </section>
    </main>
  );
}
