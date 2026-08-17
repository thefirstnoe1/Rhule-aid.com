'use client';

import { useEffect, useState } from 'react';

type AlertItem = {
  id?: string;
  headline?: string;
  event?: string;
  severity?: string;
};

type AlertHealth = {
  freshness?: { cached?: boolean; stale?: boolean; source?: string; dataUpdatedAt?: string; sourceState?: string };
  sourceHealth?: Record<string, { state?: string; stale?: boolean }>;
};

export function WeatherAlerts() {
  const [state, setState] = useState<'loading' | 'loaded' | 'unavailable'>('loading');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [health, setHealth] = useState<AlertHealth>({});

  useEffect(() => {
    let active = true;
    fetch('/api/weather/alerts?location=Lincoln%2C%20NE', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('alerts unavailable');
        const payload = await response.json() as { success?: boolean; alerts?: AlertItem[]; data?: { alerts?: AlertItem[] } | AlertItem[]; meta?: AlertHealth };
        if (payload.success === false) throw new Error('alerts unavailable');
        const value = Array.isArray(payload.data) ? payload.data : payload.data?.alerts || payload.alerts || [];
        if (active) {
          setAlerts(Array.isArray(value) ? value : []);
          setHealth(payload.meta || {});
          setState('loaded');
        }
      })
      .catch(() => {
        if (active) setState('unavailable');
      });
    return () => { active = false; };
  }, []);

  if (state === 'loading') return null;

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-5" aria-live="polite">
      <p className="eyebrow mb-3">Lincoln Alerts</p>
      {state === 'unavailable' ? <p className="text-sm text-[var(--muted)]">Weather alerts unavailable.</p> : null}
      {state === 'loaded' && health.freshness?.stale ? <p className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-[#9a5a18]">Alerts may be outdated · data from {formatDate(health.freshness.dataUpdatedAt)}</p> : null}
      {state === 'loaded' && alerts.length > 0 ? (
        <div className="grid gap-2" role="list">
          {alerts.slice(0, 2).map((alert, index) => (
            <div key={alert.id || `${alert.event}-${index}`} className="weather-alert" role="listitem">
              <span className="weather-alert-mark" aria-hidden="true">!</span>
              <div>
                <p className="font-black">{alert.headline || alert.event || 'Active weather alert'}</p>
                {alert.severity ? <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{alert.severity}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : state === 'loaded' ? (
        <p className="text-sm text-[var(--muted)]">No active alerts.</p>
      ) : null}
    </div>
  );
}

function formatDate(value?: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'recently';
}
