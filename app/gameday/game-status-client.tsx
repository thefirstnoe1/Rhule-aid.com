'use client';

import { useEffect, useRef, useState } from 'react';
import { GameCountdown } from './game-countdown';
import type { LiveGameState, LiveGameStatusResponse } from '../../src/contracts/gameday';

type GameStatusClientProps = {
  season: number;
  gameKey?: string;
  kickoffAt?: string;
  kickoffStatus?: 'confirmed' | 'tba';
  gameDate: string;
  gameTime: string;
  isHome: boolean;
  opponent: string;
  className?: string;
};

type Score = { home: number; away: number };

export function GameStatusClient(props: GameStatusClientProps) {
  const [status, setStatus] = useState<LiveGameState>('scheduled');
  const [detail, setDetail] = useState('');
  const [score, setScore] = useState<Score | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const timerRef = useRef<number | undefined>(undefined);
  const requestRef = useRef(false);
  const statusRef = useRef<LiveGameState>('scheduled');

  useEffect(() => {
    if (!props.kickoffAt || !props.gameKey) return;
    const kickoff = Date.parse(props.kickoffAt);
    if (!Number.isFinite(kickoff)) return;

    let active = true;
    const clearTimer = () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    };
    const inWindow = () => Date.now() >= kickoff - 90 * 60_000 && Date.now() <= kickoff + 8 * 60 * 60_000;

    const scheduleNext = () => {
      if (!active || document.hidden || ['final', 'canceled', 'postponed'].includes(statusRef.current)) return;
      if (Date.now() > kickoff + 8 * 60 * 60_000) return;
      const delay = Math.max(0, kickoff - 90 * 60_000 - Date.now());
      timerRef.current = window.setTimeout(poll, delay || (statusRef.current === 'live' ? 30_000 : 60_000));
    };
    const poll = async () => {
      if (!active || document.hidden || requestRef.current || !inWindow()) return;
      requestRef.current = true;
      try {
        const response = await fetch(`/api/games/status?season=${encodeURIComponent(String(props.season))}&gameKey=${encodeURIComponent(props.gameKey!)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as LiveGameStatusResponse;
        const next = payload.success && payload.data ? payload.data : null;
        if (!next) return;
        setStatus(next.status);
        statusRef.current = next.status;
        setDetail(next.detail || '');
        if (next.homeScore !== undefined && next.awayScore !== undefined) {
          setScore({ home: next.homeScore, away: next.awayScore });
        }
        const dataUpdatedAt = next.freshness?.dataUpdatedAt;
        const parsedUpdatedAt = dataUpdatedAt ? Date.parse(dataUpdatedAt) : NaN;
        if (Number.isFinite(parsedUpdatedAt)) setUpdatedAt(parsedUpdatedAt);
        setIsStale(Boolean(next.freshness?.stale));
        setAnnouncement(getAnnouncement(next.status, next.detail, next.homeScore, next.awayScore, Boolean(next.freshness?.stale)));
      } catch {
        // Retain last valid display. Next scheduled poll retries.
      } finally {
        requestRef.current = false;
        if (active && !document.hidden && !['final', 'canceled', 'postponed'].includes(statusRef.current)) {
          if (inWindow()) timerRef.current = window.setTimeout(poll, isLive(statusRef.current) ? 30_000 : 60_000);
          else scheduleNext();
        }
      }
    };
    const resume = () => {
      clearTimer();
      if (!document.hidden && !['final', 'canceled', 'postponed'].includes(statusRef.current)) {
        if (inWindow()) void poll();
        else scheduleNext();
      }
    };

    document.addEventListener('visibilitychange', resume);
    resume();
    return () => {
      active = false;
      clearTimer();
      document.removeEventListener('visibilitychange', resume);
    };
  }, [props.gameKey, props.kickoffAt, props.season]);

  const confirmed = props.kickoffStatus === 'confirmed' && Boolean(props.kickoffAt);
  return (
    <div className={props.className}>
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <span className={`status-pill status-${status}`}>
          {getStatusLabel(status, confirmed)}
        </span>
        {(status === 'live' || status === 'in_progress') && detail ? <span className="text-sm font-bold text-white/65">{detail}</span> : null}
        {(status === 'live' || status === 'in_progress' || status === 'final') && score ? <span className="text-sm font-black text-white">Nebraska {props.isHome ? score.home : score.away} — {props.isHome ? score.away : score.home} {props.opponent}</span> : null}
      </div>
      {status === 'live' || status === 'in_progress' || status === 'final' ? (
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.14em] text-white/65">{status === 'final' ? 'Final score' : 'Live score'}</p>
      ) : confirmed ? (
        <GameCountdown kickoffAt={props.kickoffAt} season={props.season} gameKey={props.gameKey} />
      ) : (
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.16em] text-white/60">{props.gameDate} / {props.gameTime}</p>
      )}
      {updatedAt ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-white/45">{formatFreshness(updatedAt, isStale)}</p> : null}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}

function getStatusLabel(status: LiveGameState, confirmed: boolean) {
  if (status === 'live' || status === 'in_progress') return 'Live now';
  if (status === 'final') return 'Final';
  if (status === 'canceled') return 'Canceled';
  if (status === 'postponed') return 'Postponed';
  if (status === 'pre') return 'Pre-game';
  if (status === 'unknown') return 'Status unavailable';
  return confirmed ? 'Kickoff confirmed' : 'Kickoff time TBD';
}

function getAnnouncement(status: LiveGameState, detail: string | undefined, home: number | undefined, away: number | undefined, stale: boolean) {
  const freshness = stale ? ' Live data is stale.' : '';
  if (status === 'live' || status === 'in_progress') return `Game is live${detail ? `, ${detail}` : ''}${home !== undefined && away !== undefined ? `. Score ${home} to ${away}` : ''}.${freshness}`;
  if (status === 'final') return `Game final${home !== undefined && away !== undefined ? `. Final score ${home} to ${away}` : ''}.${freshness}`;
  return `${getStatusLabel(status, true)}.${freshness}`;
}

function isLive(status: LiveGameState) {
  return status === 'live' || status === 'in_progress';
}

function formatFreshness(value: number, stale: boolean) {
  const formatted = new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return stale ? `Data from ${formatted} · stale` : `Updated ${formatted}`;
}
