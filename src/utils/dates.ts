const MONTHS_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

const MONTHS_CA: Record<string, number> = {
  gener: 0, febrer: 1, 'març': 2, abril: 3, maig: 4, juny: 5,
  juliol: 6, agost: 7, setembre: 8, octubre: 9, novembre: 10, desembre: 11,
};

const TZ_OFFSET_CET = 1;  // UTC+1
const TZ_OFFSET_CEST = 2; // UTC+2

/**
 * Parse a date string from various formats into a Date object.
 * Handles ISO 8601, DD/MM/YYYY, Spanish textual dates, and Unix timestamps.
 */
export function parseEventDate(raw: string): Date {
  const trimmed = raw.trim();

  // Unix timestamp (seconds or milliseconds)
  if (/^\d{10,13}$/.test(trimmed)) {
    const ts = Number(trimmed);
    return new Date(ts > 1e12 ? ts : ts * 1000);
  }

  // ISO 8601 (with or without timezone)
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  // ISO date only: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + 'T00:00:00+01:00'); // Assume CET
    if (!isNaN(d.getTime())) return d;
  }

  // DD/MM/YYYY or DD-MM-YYYY with optional time
  const euMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (euMatch) {
    const [, day, month, year, hour, minute] = euMatch;
    const d = new Date(
      Number(year), Number(month) - 1, Number(day),
      Number(hour ?? 0), Number(minute ?? 0),
    );
    if (!isNaN(d.getTime())) return d;
  }

  // Spanish textual: "10 de abril de 2026"
  const esMatch = trimmed.toLowerCase().match(
    /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})(?:[\s,]+(\d{1,2}):(\d{2}))?/,
  );
  if (esMatch) {
    const [, day, monthName, year, hour, minute] = esMatch;
    const monthIdx = MONTHS_ES[monthName] ?? MONTHS_CA[monthName];
    if (monthIdx !== undefined) {
      const d = new Date(
        Number(year), monthIdx, Number(day),
        Number(hour ?? 0), Number(minute ?? 0),
      );
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Fallback: native Date parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d;

  throw new Error(`Cannot parse date: "${raw}"`);
}

// --- Date range helpers (Europe/Madrid) ---

const MADRID_TZ = 'Europe/Madrid';

function toMadridDate(date: Date): Date {
  const str = date.toLocaleDateString('en-CA', { timeZone: MADRID_TZ }); // YYYY-MM-DD
  return new Date(str + 'T00:00:00');
}

export function startOfDayMadrid(date: Date = new Date()): Date {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: MADRID_TZ });
  // Create a date at midnight Madrid time
  const madridOffset = getMadridOffset(date);
  return new Date(`${dateStr}T00:00:00${formatOffset(madridOffset)}`);
}

export function endOfDayMadrid(date: Date = new Date()): Date {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: MADRID_TZ });
  const madridOffset = getMadridOffset(date);
  return new Date(`${dateStr}T23:59:59${formatOffset(madridOffset)}`);
}

function getMadridOffset(date: Date): number {
  // Use Intl to get the actual offset for the given date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID_TZ,
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  if (tzPart) {
    const match = tzPart.value.match(/GMT([+-]\d+)/);
    if (match) return Number(match[1]);
  }
  return 1; // Default to CET
}

function formatOffset(hours: number): string {
  const sign = hours >= 0 ? '+' : '-';
  const abs = Math.abs(hours);
  return `${sign}${String(abs).padStart(2, '0')}:00`;
}

export function getTodayRange(): { from: Date; to: Date } {
  const now = new Date();
  return { from: startOfDayMadrid(now), to: endOfDayMadrid(now) };
}

export function getTomorrowRange(): { from: Date; to: Date } {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { from: startOfDayMadrid(tomorrow), to: endOfDayMadrid(tomorrow) };
}

export function getWeekendRange(): { from: Date; to: Date } {
  const now = new Date();
  const madridDateStr = now.toLocaleDateString('en-CA', { timeZone: MADRID_TZ });
  const madridDate = new Date(madridDateStr);
  const day = madridDate.getDay(); // 0=Sun, 6=Sat

  let saturday: Date;
  if (day === 6) {
    // Today is Saturday
    saturday = new Date(madridDate);
  } else if (day === 0) {
    // Today is Sunday - show today
    return { from: startOfDayMadrid(now), to: endOfDayMadrid(now) };
  } else {
    // Weekday - find next Saturday
    saturday = new Date(madridDate);
    saturday.setDate(saturday.getDate() + (6 - day));
  }

  const sunday = new Date(saturday);
  sunday.setDate(sunday.getDate() + 1);

  return { from: startOfDayMadrid(saturday), to: endOfDayMadrid(sunday) };
}

export function getWeekRange(): { from: Date; to: Date } {
  const now = new Date();
  // Use Madrid-aware date to avoid local-timezone off-by-one errors in UTC containers
  const madridDateStr = now.toLocaleDateString('en-CA', { timeZone: MADRID_TZ });
  const madridDate = new Date(madridDateStr);
  const endDate = new Date(madridDate);
  endDate.setDate(endDate.getDate() + 7);
  return { from: startOfDayMadrid(now), to: endOfDayMadrid(endDate) };
}

/** Format a date for display in Telegram messages */
export function formatEventDate(date: Date, includeDay: boolean = true): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: MADRID_TZ,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  if (includeDay) {
    opts.weekday = 'short';
  }
  return date.toLocaleString('en-GB', opts);
}

export function formatDateOnly(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    timeZone: MADRID_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
