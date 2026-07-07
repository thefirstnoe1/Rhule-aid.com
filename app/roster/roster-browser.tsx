'use client';

import { useMemo, useState } from 'react';
import { SurfaceCard } from '../components/ui';

export type Player = {
  number: number;
  name: string;
  position: string;
  class: string;
  height: string;
  weight: string;
  hometown: string;
  category?: string;
};

const groups = [
  { label: 'All', value: 'all' },
  { label: 'Offense', value: 'offense' },
  { label: 'Defense', value: 'defense' },
  { label: 'Special', value: 'special' }
];

export function RosterBrowser({ players }: { players: Player[] }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return players.filter((player) => {
      const matchesGroup = group === 'all' || player.category === group;
      const haystack = `${player.name} ${player.position} ${player.hometown} ${player.class}`.toLowerCase();
      return matchesGroup && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [group, players, query]);

  return (
    <section className="container-shell pb-20">
      <div className="mb-6 flex flex-col gap-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search player, position, hometown..."
          className="min-h-12 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-5 text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        />
        <div className="flex flex-wrap gap-2">
          {groups.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setGroup(item.value)}
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${group === item.value ? 'bg-[var(--foreground)] text-[var(--background)]' : 'border border-[var(--border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredPlayers.map((player) => <PlayerCard key={`${player.number}-${player.name}`} player={player} />)}
      </div>

      {filteredPlayers.length === 0 && (
        <SurfaceCard className="rounded-[1.75rem] p-8 text-center">
          <h2 className="text-2xl font-black tracking-[-0.04em]">No players match that search.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Try a name, position, class, or hometown.</p>
        </SurfaceCard>
      )}
    </section>
  );
}

function PlayerCard({ player }: { player: Player }) {
  return (
    <SurfaceCard className="rounded-[1.75rem] p-6 transition hover:-translate-y-1 hover:border-[var(--scarlet)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">{player.position || 'Player'}</p>
          <h2 className="text-2xl font-black leading-tight tracking-[-0.05em]">{player.name}</h2>
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--foreground)] text-2xl font-black text-[var(--background)]">
          {player.number ?? '--'}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <Detail label="Class" value={player.class} />
        <Detail label="Size" value={`${player.height || '-'} / ${player.weight || '-'}`} />
        <div className="col-span-2"><Detail label="Hometown" value={player.hometown} /></div>
      </div>
    </SurfaceCard>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
      <div className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-black">{value || '-'}</div>
    </div>
  );
}
