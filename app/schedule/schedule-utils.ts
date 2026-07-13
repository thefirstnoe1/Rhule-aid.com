type SelectableScheduleGame = {
  date: string;
  time: string;
  result?: string;
  score?: string;
};

const chicagoTimeZone = 'America/Chicago';

export function selectNextGame<T extends SelectableScheduleGame>(games: readonly T[], now: Date): T | undefined {
  const today = getChicagoDateKey(now);

  return games
    .map((game, index) => ({ game, index, dateKey: getScheduleDateKey(game.date), time: getTimeSortValue(game.time) }))
    // The API's result is derived from current point totals, so it can be W/L
    // while a game is still live. Date is the conservative eligibility boundary.
    .filter(({ dateKey }) => dateKey !== null && dateKey >= today)
    .sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey!.localeCompare(b.dateKey!);
      if (a.time !== b.time) return a.time - b.time;
      return a.index - b.index;
    })
    .at(0)?.game;
}

function getScheduleDateKey(value: string): string | null {
  if (!value || value === 'TBD') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getChicagoDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: chicagoTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function getTimeSortValue(value: string) {
  if (!value || value === 'TBD') return Number.POSITIVE_INFINITY;
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return Number.POSITIVE_INFINITY;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}
