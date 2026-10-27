import { ScheduleEvent } from '@/types';

const DAY_PATTERNS: Record<string, string[]> = {
  monday: ['mon', 'monday', 'm'],
  tuesday: ['tue', 'tues', 'tuesday'],
  wednesday: ['wed', 'weds', 'wednesday'],
  thursday: ['thu', 'thur', 'thurs', 'thursday'],
  friday: ['fri', 'friday', 'f'],
  saturday: ['sat', 'saturday', 's'],
  sunday: ['sun', 'sunday'],
};

const TYPE_PATTERNS: { type: ScheduleEvent['type']; patterns: string[] }[] = [
  { type: 'exam', patterns: ['exam', 'midterm', 'final', 'test'] },
  { type: 'assignment', patterns: ['assignment', 'homework', 'hw', 'project', 'essay', 'paper', 'due'] },
  { type: 'lecture', patterns: ['lecture', 'class', 'session', 'seminar', 'lab'] },
  { type: 'study', patterns: ['study', 'review', 'review session', 'office hours'] },
];

const TIME_REGEX = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi;

function parseDays(text: string): number[] {
  const lower = text.toLowerCase();
  const days: number[] = [];
  (Object.entries(DAY_PATTERNS) as [string, string[]][]).forEach(([_, aliases], idx) => {
    for (const alias of aliases) {
      const re = new RegExp(`\\b${alias}\\b`, 'i');
      if (re.test(lower)) {
        days.push(idx);
        break;
      }
    }
  });
  return [...new Set(days)];
}

function parseTimes(text: string): { start: string; end: string } | null {
  const matches: { h: number; m: number; pm: boolean }[] = [];
  let m: RegExpExecArray | null;
  TIME_REGEX.lastIndex = 0;
  while ((m = TIME_REGEX.exec(text)) !== null) {
    let h = parseInt(m[1] ?? '0', 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const suffix = m[3]?.toLowerCase();
    let pm = false;
    if (suffix === 'pm' && h < 12) { h += 12; pm = true; }
    if (suffix === 'am' && h === 12) h = 0;
    if (!suffix && h <= 7) { h += 12; pm = true; }
    matches.push({ h, m: min, pm });
  }
  if (matches.length === 0) return null;
  const start = matches[0];
  if (!start) return null;
  const end = matches[1] || { h: start.h + 1, m: start.m };
  const fmt = (t: { h: number; m: number }) =>
    `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}

function detectType(text: string): ScheduleEvent['type'] {
  const lower = text.toLowerCase();
  for (const { type, patterns } of TYPE_PATTERNS) {
    if (patterns.some((p) => lower.includes(p))) return type;
  }
  return 'other';
}

export function parseSyllabus(
  text: string,
  courseId: string | null,
  baseDate?: Date
): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const lines = text.split('\n').filter((l) => l.trim().length > 3);
  const ref = baseDate || new Date();

  for (const line of lines) {
    const days = parseDays(line);
    const times = parseTimes(line);
    const type = detectType(line);
    const title = line.trim().replace(/\s+/g, ' ').slice(0, 80);

    if (days.length === 0 && !times) continue;

    if (days.length > 0) {
      for (const dayIdx of days) {
        const date = new Date(ref);
        const diff = (dayIdx - date.getDay() + 7) % 7;
        date.setDate(date.getDate() + diff);
        const timesResult = times || { start: '09:00', end: '10:00' };
        events.push({
          id: crypto.randomUUID(),
          title,
          courseId,
          date: date.toISOString().slice(0, 10),
          startTime: timesResult.start,
          endTime: timesResult.end,
          type,
        });
      }
    } else if (times) {
      const date = new Date(ref);
      const dateStr = date.toISOString().slice(0, 10);
      events.push({
        id: crypto.randomUUID(),
        title,
        courseId,
        date: dateStr,
        startTime: times.start,
        endTime: times.end,
        type,
      });
    }
  }

  return events;
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTimeLabel(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}
