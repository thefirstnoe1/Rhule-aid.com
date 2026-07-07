import { SiteHeader } from '../components/site-header';
import { PageHero } from '../components/page-hero';
import { SurfaceCard } from '../components/ui';

const milestones = [
  { label: 'Temple', value: '2-10 to 10-4', detail: 'Built a winner from a depleted roster.' },
  { label: 'Baylor', value: '1-11 to 11-3', detail: 'Engineered one of the fastest Power Five turnarounds.' },
  { label: 'Nebraska', value: 'Program build', detail: 'Focused on development, depth, and week-to-week standards.' }
];

const principles = [
  'Player development over quick fixes',
  'Line-of-scrimmage depth',
  'Recruiting fit and retention',
  'Special teams and situational football',
  'A tougher weekly floor'
];

export default function RhuleAidPage() {
  return (
    <main>
      <SiteHeader />
      <PageHero eyebrow="Coach Rhule" title="The rebuild, tracked without the noise." />
      <section className="container-shell grid gap-6 pb-20 lg:grid-cols-[1fr_0.9fr]">
        <SurfaceCard className="rounded-[2rem] p-8 md:p-10">
          <p className="eyebrow mb-4">Profile</p>
          <h2 className="text-4xl font-black tracking-[-0.06em]">Rhule&apos;s best teams were built, not patched.</h2>
          <p className="mt-5 text-base leading-8 text-[var(--muted)]">
            The Nebraska project is about stacking recruiting classes, developing bodies, improving the trenches, and turning close-game margins into a repeatable advantage. This page will become the home for coach context, program trajectory, and season-by-season markers as the Next migration continues.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {milestones.map((item) => (
              <div key={item.label} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] p-5">
                <div className="eyebrow">{item.label}</div>
                <div className="mt-3 text-2xl font-black tracking-[-0.05em] text-[var(--scarlet)]">{item.value}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
        <SurfaceCard className="rounded-[2rem] p-8 md:p-10">
          <p className="eyebrow mb-4">What To Watch</p>
          <div className="grid gap-3">
            {principles.map((principle) => (
              <div key={principle} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-sm font-black">
                {principle}
              </div>
            ))}
          </div>
        </SurfaceCard>
      </section>
    </main>
  );
}
