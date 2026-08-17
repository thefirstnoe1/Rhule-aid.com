'use client';

import { useEffect, useMemo, useState } from 'react';

type GameCountdownProps = {
  kickoffAt?: string;
  season: number;
  gameKey?: string;
};

export function GameCountdown({ kickoffAt, season, gameKey }: GameCountdownProps) {
  const kickoff = useMemo(() => kickoffAt ? Date.parse(kickoffAt) : NaN, [kickoffAt]);
  const [remaining, setRemaining] = useState(() => getRemaining(kickoff));

  useEffect(() => {
    if (!Number.isFinite(kickoff)) return;

    const update = () => setRemaining(getRemaining(kickoff));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [kickoff]);

  if (!Number.isFinite(kickoffAt ? kickoff : NaN)) return null;

  const calendarHref = gameKey
    ? `/api/games/calendar?season=${encodeURIComponent(String(season))}&gameKey=${encodeURIComponent(gameKey)}`
    : undefined;

  return (
    <div className="game-countdown" aria-label={getCountdownLabel(remaining)}>
      <div>
        <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-white/55">Kickoff confirmed</p>
        <p className="mt-2 font-mono text-3xl font-black tracking-[-0.07em] text-white sm:text-4xl">
          {remaining.total <= 0 ? 'Starting now' : formatRemaining(remaining)}
        </p>
      </div>
      {calendarHref ? (
        <a
          href={calendarHref}
          className="rounded-full border border-white/25 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-white transition hover:border-white hover:bg-white/10"
        >
          Add to calendar
        </a>
      ) : null}
    </div>
  );
}

type Remaining = { total: number; days: number; hours: number; minutes: number; seconds: number };

function getRemaining(kickoff: number): Remaining {
  const total = Number.isFinite(kickoff) ? kickoff - Date.now() : 0;
  const seconds = Math.max(0, Math.floor(total / 1000));
  return {
    total,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60
  };
}

function formatRemaining(value: Remaining) {
  if (value.days > 0) return `T− ${value.days}d ${pad(value.hours)}h ${pad(value.minutes)}m`;
  return `T− ${pad(value.hours)}:${pad(value.minutes)}:${pad(value.seconds)}`;
}

function getCountdownLabel(value: Remaining) {
  if (value.total <= 0) return 'Kickoff is starting now';
  return `Kickoff in ${value.days} days, ${value.hours} hours, ${value.minutes} minutes`;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}
