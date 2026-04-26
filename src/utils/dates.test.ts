import { describe, test, expect } from 'vitest';
import {
  parseEventDate,
  ddmmyyyyToMadridIso,
  getTodayRange,
  getTomorrowRange,
  getWeekRange,
  getWeekendRange,
} from './dates.js';

describe('parseEventDate', () => {
  test('parses ISO 8601 with timezone', () => {
    const d = parseEventDate('2026-04-05T14:30:00+02:00');
    expect(d).toBeInstanceOf(Date);
    // 14:30 CEST (UTC+2) = 12:30 UTC
    expect(d.toISOString()).toBe('2026-04-05T12:30:00.000Z');
  });

  test('parses ISO date only with CET offset', () => {
    // The function hardcodes +01:00 (CET) regardless of DST
    const d = parseEventDate('2026-04-05');
    expect(d).toBeInstanceOf(Date);
    // Midnight CET (UTC+1) = 23:00 previous day UTC
    expect(d.toISOString()).toBe('2026-04-04T23:00:00.000Z');
  });

  test('parses EU format DD/MM/YYYY', () => {
    const d = parseEventDate('05/04/2026');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April = 3
    expect(d.getDate()).toBe(5);
  });

  test('parses EU format with time DD/MM/YYYY HH:mm', () => {
    const d = parseEventDate('05/04/2026 14:30');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  test('parses Spanish textual date', () => {
    const d = parseEventDate('10 de abril de 2026');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April
    expect(d.getDate()).toBe(10);
  });

  test('parses Unix timestamp in seconds', () => {
    const d = parseEventDate('1743854400');
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBe(1743854400 * 1000);
  });

  test('parses Unix timestamp in milliseconds', () => {
    const d = parseEventDate('1743854400000');
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBe(1743854400000);
  });

  test('throws for invalid date string', () => {
    expect(() => parseEventDate('not a date')).toThrow('Cannot parse date');
  });
});

describe('ddmmyyyyToMadridIso', () => {
  test('uses CEST (+02:00) for July', () => {
    expect(ddmmyyyyToMadridIso('15/07/2026')).toBe('2026-07-15T12:00:00+02:00');
  });

  test('uses CET (+01:00) for January', () => {
    expect(ddmmyyyyToMadridIso('15/01/2026')).toBe('2026-01-15T12:00:00+01:00');
  });

  test('handles late-March DST transition correctly (CEST already)', () => {
    // 2026 DST switch: last Sunday of March = March 29. Days 30-31 are CEST.
    // Naive month-only logic would say "March = CET" which is wrong here.
    expect(ddmmyyyyToMadridIso('30/03/2026')).toBe('2026-03-30T12:00:00+02:00');
    expect(ddmmyyyyToMadridIso('31/03/2026')).toBe('2026-03-31T12:00:00+02:00');
  });

  test('handles late-October DST transition correctly (CET already)', () => {
    // 2026 DST end: last Sunday of October = October 25. Days 26-31 are CET.
    // Naive month-only logic would say "October = CEST" which is wrong here.
    expect(ddmmyyyyToMadridIso('26/10/2026')).toBe('2026-10-26T12:00:00+01:00');
    expect(ddmmyyyyToMadridIso('31/10/2026')).toBe('2026-10-31T12:00:00+01:00');
  });

  test('zero-pads single-digit day and month', () => {
    expect(ddmmyyyyToMadridIso('5/8/2026')).toBe('2026-08-05T12:00:00+02:00');
  });

  test('respects custom hour and minute', () => {
    expect(ddmmyyyyToMadridIso('10/06/2026', 19, 30)).toBe('2026-06-10T19:30:00+02:00');
  });

  test('round-trips through parseEventDate to a valid Date', () => {
    const iso = ddmmyyyyToMadridIso('15/07/2026');
    const d = parseEventDate(iso);
    expect(d.toISOString()).toBe('2026-07-15T10:00:00.000Z'); // 12:00 CEST = 10:00 UTC
  });

  test('leap year Feb 29 is preserved', () => {
    expect(ddmmyyyyToMadridIso('29/02/2028')).toBe('2028-02-29T12:00:00+01:00');
  });
});

describe('getTodayRange', () => {
  test('returns from < to on the same day', () => {
    const { from, to } = getTodayRange();
    expect(from.getTime()).toBeLessThan(to.getTime());
    // Both should be the same calendar day in Madrid
    const fromDate = from.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    const toDate = to.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    expect(fromDate).toBe(toDate);
  });
});

describe('getTomorrowRange', () => {
  test('from is 1 day after today', () => {
    const today = getTodayRange();
    const tomorrow = getTomorrowRange();
    const todayStr = today.from.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    const tomorrowStr = tomorrow.from.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    // Parse and compare
    const todayDate = new Date(todayStr);
    const tomorrowDate = new Date(tomorrowStr);
    const diffMs = tomorrowDate.getTime() - todayDate.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  test('from < to', () => {
    const { from, to } = getTomorrowRange();
    expect(from.getTime()).toBeLessThan(to.getTime());
  });
});

describe('getWeekRange', () => {
  test('to is ~7-8 days after from', () => {
    const { from, to } = getWeekRange();
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    // from = start of today, to = end of day+7, so range is ~7-8 days
    expect(diffDays).toBeGreaterThanOrEqual(6.9);
    expect(diffDays).toBeLessThanOrEqual(8.1);
  });

  test('from < to', () => {
    const { from, to } = getWeekRange();
    expect(from.getTime()).toBeLessThan(to.getTime());
  });
});

describe('getWeekendRange', () => {
  test('range includes a Saturday', () => {
    const { from, to } = getWeekendRange();
    expect(from.getTime()).toBeLessThan(to.getTime());

    // Check that at least one day in the range is a Saturday (day 6)
    const current = new Date(from);
    let hasSaturday = false;
    while (current <= to) {
      // Get the day in Madrid timezone
      const dayStr = current.toLocaleDateString('en-US', {
        timeZone: 'Europe/Madrid',
        weekday: 'long',
      });
      if (dayStr === 'Saturday') {
        hasSaturday = true;
        break;
      }
      current.setDate(current.getDate() + 1);
    }
    // On Sunday, the range is just Sunday, so Saturday might not be included
    const nowDay = new Date().toLocaleDateString('en-US', {
      timeZone: 'Europe/Madrid',
      weekday: 'long',
    });
    if (nowDay !== 'Sunday') {
      expect(hasSaturday).toBe(true);
    }
  });

  test('from < to', () => {
    const { from, to } = getWeekendRange();
    expect(from.getTime()).toBeLessThan(to.getTime());
  });
});
