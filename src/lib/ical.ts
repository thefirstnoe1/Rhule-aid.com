import type { CanonicalScheduleGame } from '../contracts/gameday';

const CALENDAR_URL = 'https://rhule-aid.com/schedule';

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function hashGameKey(value: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (const character of value) {
    const code = character.codePointAt(0) || 0;
    first ^= code;
    first = Math.imul(first, 16777619);
    second ^= code + 0x9e3779b9;
    second = Math.imul(second, 3266489917);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function utcDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid kickoff date');
  const part = (number: number) => number.toString().padStart(2, '0');
  return `${date.getUTCFullYear().toString().padStart(4, '0')}${part(date.getUTCMonth() + 1)}${part(date.getUTCDate())}T${part(date.getUTCHours())}${part(date.getUTCMinutes())}${part(date.getUTCSeconds())}Z`;
}

function foldLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let octets = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).byteLength;
    const limit = result.length === 0 ? 75 : 74;
    if (current && octets + size > limit) {
      result.push(result.length === 0 ? current : ` ${current}`);
      current = '';
      octets = 0;
    }
    current += character;
    octets += size;
  }
  if (current || !result.length) result.push(result.length === 0 ? current : ` ${current}`);
  return result;
}

function icalLines(game: CanonicalScheduleGame, now: Date): string[] {
  const matchup = `${game.awayTeam} at ${game.homeTeam}`;
  const location = game.venue?.name || game.location || 'TBA';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rhule-Aid//Game Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:game-${hashGameKey(game.gameKey)}@rhule-aid.com`,
    `DTSTAMP:${utcDate(now.toISOString())}`,
    `DTSTART:${utcDate(game.kickoffAt || '')}`,
    `SUMMARY:${escapeText(matchup)}`,
    `DESCRIPTION:${escapeText(`${matchup} at ${location}`)}`,
    `LOCATION:${escapeText(location)}`,
    `URL:${CALENDAR_URL}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Game reminder',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
}

export function generateGameIcal(game: CanonicalScheduleGame, now = new Date()): string {
  return icalLines(game, now).flatMap(foldLine).join('\r\n') + '\r\n';
}

export { CALENDAR_URL };
