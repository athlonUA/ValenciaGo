import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StoredEvent } from '../types/index.js';
import { EventCategory } from '../types/category.js';
import {
  formatEventCard,
  formatEventList,
  formatOngoingDateLabel,
  formatWelcome,
} from './formatters.js';

const sampleEvent: StoredEvent = {
  id: 'test-1',
  source: 'meetup',
  sourceId: 'e1',
  sourceUrl: 'https://meetup.com/e/1',
  title: 'Jazz Night',
  titleNormalized: 'jazz night',
  description: 'Great jazz',
  category: EventCategory.MUSIC,
  tags: ['music'],
  city: 'Valencia',
  venue: 'La Rambleta',
  address: 'Blvd Sur',
  latitude: 39.45,
  longitude: -0.38,
  startsAt: new Date('2026-04-10T20:00:00+02:00'),
  endsAt: undefined,
  priceInfo: '€10',
  isFree: false,
  language: 'en',
  imageUrl: undefined,
  rawPayload: undefined,
  contentHash: 'hash1',
  summary: 'Live jazz music show',
  emoji: '🎷',
  aiPrice: '€10',
  aiTime: '20:00',
  createdAt: new Date(),
  updatedAt: new Date(),
  ingestedAt: new Date(),
};

describe('formatEventCard', () => {
  test('contains escaped title in bold', () => {
    const card = formatEventCard(sampleEvent);
    expect(card).toContain('<b>Jazz Night</b>');
  });

  test('contains Map link when venue present', () => {
    const card = formatEventCard(sampleEvent);
    expect(card).toContain('Map</a>');
  });

  test('contains Details link', () => {
    const card = formatEventCard(sampleEvent);
    expect(card).toContain('Details</a>');
    expect(card).toContain('https://meetup.com/e/1');
  });

  test('shows summary in italics', () => {
    const card = formatEventCard(sampleEvent);
    expect(card).toContain('<i>Live jazz music show</i>');
  });

  test('escapes HTML special characters in title', () => {
    const event = { ...sampleEvent, title: 'Rock & Roll <Live>' };
    const card = formatEventCard(event);
    expect(card).toContain('Rock &amp; Roll &lt;Live&gt;');
  });

  test('omits Map link when venue is absent', () => {
    const event = { ...sampleEvent, venue: undefined, latitude: undefined, longitude: undefined };
    const card = formatEventCard(event);
    expect(card).not.toContain('Map</a>');
  });

  test('shows aiTime for non-visitvalencia source with placeholder time', () => {
    const event: StoredEvent = {
      ...sampleEvent,
      source: 'meetup',
      startsAt: new Date('2026-04-10T12:00:00+02:00'), // noon placeholder
      aiTime: '19:00',
    };
    const card = formatEventCard(event);
    expect(card).toContain('19:00');
  });

  test('suppresses aiTime for visitvalencia source', () => {
    const event: StoredEvent = {
      ...sampleEvent,
      source: 'visitvalencia',
      startsAt: new Date('2026-04-10T12:00:00+02:00'), // noon placeholder
      aiTime: '10:00',
    };
    const card = formatEventCard(event);
    expect(card).not.toContain('10:00');
  });

  test('visitvalencia shows date only without time', () => {
    const event: StoredEvent = {
      ...sampleEvent,
      source: 'visitvalencia',
      startsAt: new Date('2026-04-10T12:00:00+02:00'),
      aiTime: '10:00',
    };
    const card = formatEventCard(event);
    // Should show date without time
    expect(card).toMatch(/\w+ \d+ \w+/); // e.g. "Fri 10 Apr"
    expect(card).not.toMatch(/\d+ \w+, \d{1,2}:\d{2}/); // no "10 Apr, 10:00" pattern
  });

  // Ukrainian locale tests
  test('shows Ukrainian link labels with uk locale', () => {
    const card = formatEventCard(sampleEvent, 'uk');
    expect(card).toContain('Карта</a>');
    expect(card).toContain('Деталі</a>');
  });

  test('shows "Безкоштовно" for free events in uk locale', () => {
    const freeEvent = { ...sampleEvent, aiPrice: undefined, isFree: true, priceInfo: undefined };
    const card = formatEventCard(freeEvent, 'uk');
    expect(card).toContain('Безкоштовно');
  });

  test('localizes aiPrice="Free" to "Безкоштовно" in uk locale', () => {
    const freeEvent = { ...sampleEvent, aiPrice: 'Free', isFree: false, priceInfo: undefined };
    const card = formatEventCard(freeEvent, 'uk');
    expect(card).toContain('Безкоштовно');
    expect(card).not.toMatch(/·\s*Free/);
  });

  test('renders priceInfo range as localized "from lower" in uk locale', () => {
    const event = { ...sampleEvent, aiPrice: undefined, priceInfo: '€0.00–€1535.43', isFree: false };
    const card = formatEventCard(event, 'uk');
    expect(card).toContain('Від €0');
    expect(card).not.toContain('€1535.43');
    expect(card).not.toContain('0.00');
  });

  test('renders aiPrice range as "From lower" in en locale', () => {
    const event = { ...sampleEvent, aiPrice: '€15-€25', priceInfo: undefined, isFree: false };
    const card = formatEventCard(event, 'en');
    expect(card).toContain('From €15');
    expect(card).not.toContain('€25');
  });

  test('leaves single-price aiPrice unchanged', () => {
    const event = { ...sampleEvent, aiPrice: '€10', priceInfo: undefined, isFree: false };
    const card = formatEventCard(event, 'uk');
    expect(card).toContain('€10');
    expect(card).not.toContain('Від');
  });

  test('localizes priceInfo range in es locale', () => {
    const event = { ...sampleEvent, aiPrice: undefined, priceInfo: '€10.00–€30.00', isFree: false };
    const card = formatEventCard(event, 'es');
    expect(card).toContain('Desde €10');
    expect(card).not.toContain('€30');
  });
});

describe('formatEventList', () => {
  test('shows "No events found" with empty array', () => {
    const result = formatEventList([], 'Today', 1, 1);
    expect(result).toContain('No events found');
  });

  test('shows Ukrainian "no events" with uk locale', () => {
    const result = formatEventList([], 'Сьогодні', 1, 1, 'uk');
    expect(result).toContain('Подій не знайдено');
  });

  test('shows header and cards separated by dividers', () => {
    const event2: StoredEvent = { ...sampleEvent, id: 'test-2', title: 'Flamenco Show' };
    const result = formatEventList([sampleEvent, event2], 'Today', 1, 1);
    expect(result).toContain('<b>Today</b>');
    expect(result).toContain('Jazz Night');
    expect(result).toContain('Flamenco Show');
    // Divider between cards
    expect(result).toContain('┈┈┈┈┈');
  });
});

describe('formatOngoingDateLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Sun 26 Apr 2026 17:00 UTC = 19:00 Madrid (CEST)
    vi.setSystemTime(new Date('2026-04-26T17:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('appends "last day" suffix when run ends today (Madrid)', () => {
    // Started Fri 17 Apr 12:00 Madrid, ends Sun 26 Apr 23:59 Madrid → today is the last day
    const event = {
      startsAt: new Date('2026-04-17T10:00:00Z'),
      endsAt: new Date('2026-04-26T21:59:00Z'),
      aiTime: undefined,
      source: 'visitvalencia',
    };
    // en-GB doesn't insert a comma between weekday and date; uk-UA / es-ES do.
    expect(formatOngoingDateLabel(event, 'en-GB', 'en')).toBe('Sun 26 Apr · <i>last day</i>');
    expect(formatOngoingDateLabel(event, 'uk-UA', 'uk')).toBe('нд, 26 квіт. · <i>останній день</i>');
    expect(formatOngoingDateLabel(event, 'es-ES', 'es')).toBe('dom, 26 abr · <i>último día</i>');
  });

  test('appends "until DD MMM" suffix when run continues past today', () => {
    // Started yesterday, ends 30 Apr 2026 → today + 4 more days
    const event = {
      startsAt: new Date('2026-04-25T10:00:00Z'),
      endsAt: new Date('2026-04-30T21:59:00Z'),
      aiTime: undefined,
      source: 'visitvalencia',
    };
    expect(formatOngoingDateLabel(event, 'en-GB', 'en')).toMatch(/^Sun 26 Apr · <i>until \d+ Apr<\/i>$/);
    expect(formatOngoingDateLabel(event, 'uk-UA', 'uk')).toMatch(/^нд, 26 квіт\. · <i>до /);
    expect(formatOngoingDateLabel(event, 'es-ES', 'es')).toMatch(/^dom, 26 abr · <i>hasta /);
  });

  test('includes AI-extracted time when present and trustworthy', () => {
    const event = {
      startsAt: new Date('2026-04-17T10:00:00Z'),
      endsAt: new Date('2026-04-26T21:59:00Z'),
      aiTime: '20:00',
      source: 'meetup',  // not visitvalencia → trust aiTime
    };
    expect(formatOngoingDateLabel(event, 'en-GB', 'en')).toBe('Sun 26 Apr, 20:00 · <i>last day</i>');
    expect(formatOngoingDateLabel(event, 'uk-UA', 'uk')).toBe('нд, 26 квіт., 20:00 · <i>останній день</i>');
  });

  test('skips AI time for visitvalencia (placeholder source) even if aiTime is set', () => {
    const event = {
      startsAt: new Date('2026-04-17T10:00:00Z'),
      endsAt: new Date('2026-04-26T21:59:00Z'),
      aiTime: '20:00',
      source: 'visitvalencia',
    };
    expect(formatOngoingDateLabel(event, 'en-GB', 'en')).toBe('Sun 26 Apr · <i>last day</i>');
  });

  test('skips AI time when aiTime is "TBD"', () => {
    const event = {
      startsAt: new Date('2026-04-17T10:00:00Z'),
      endsAt: new Date('2026-04-26T21:59:00Z'),
      aiTime: 'TBD',
      source: 'meetup',
    };
    expect(formatOngoingDateLabel(event, 'en-GB', 'en')).toBe('Sun 26 Apr · <i>last day</i>');
  });

  test('viewDate anchors the displayed day to the queried window (/tomorrow case)', () => {
    // Today is Sun 26 Apr. /tomorrow → viewDate = Mon 27 Apr 00:00 Madrid.
    // Event runs Apr 24 → May 3. From Sunday's perspective via /tomorrow, the user
    // expects the date in the card to read "Mon 27 Apr", not "Sun 26 Apr".
    const event = {
      startsAt: new Date('2026-04-24T10:00:00Z'),
      endsAt: new Date('2026-05-03T21:59:00Z'),
      aiTime: undefined,
      source: 'visitvalencia',
    };
    const tomorrowMidnightMadrid = new Date('2026-04-26T22:00:00Z'); // Mon 27 Apr 00:00 CEST
    expect(formatOngoingDateLabel(event, 'en-GB', 'en', tomorrowMidnightMadrid))
      .toMatch(/^Mon 27 Apr · <i>until \d+ May<\/i>$/);
    expect(formatOngoingDateLabel(event, 'uk-UA', 'uk', tomorrowMidnightMadrid))
      .toMatch(/^пн, 27 квіт\. · <i>до /);
  });

  test('viewDate does not push anchor backwards before event start', () => {
    // /this_week (range_from = Mon) but event starts Wed → anchor should be Wed, not Mon.
    const event = {
      startsAt: new Date('2026-04-29T10:00:00Z'), // Wed 29 Apr
      endsAt: new Date('2026-05-03T21:59:00Z'),
      aiTime: undefined,
      source: 'visitvalencia',
    };
    const mondayMadrid = new Date('2026-04-26T22:00:00Z'); // Mon 27 Apr 00:00 CEST
    const label = formatOngoingDateLabel(event, 'en-GB', 'en', mondayMadrid);
    expect(label).toMatch(/^Wed 29 Apr · /);
  });

  test('returns null for short-run single-day events (no endsAt or run <18h)', () => {
    expect(formatOngoingDateLabel(
      { startsAt: new Date('2026-04-25T10:00:00Z'), endsAt: undefined, aiTime: undefined, source: 'meetup' },
      'en-GB', 'en',
    )).toBeNull();
    // Run = 12h
    expect(formatOngoingDateLabel(
      {
        startsAt: new Date('2026-04-26T10:00:00Z'),
        endsAt: new Date('2026-04-26T22:00:00Z'),
        aiTime: undefined, source: 'visitvalencia',
      },
      'en-GB', 'en',
    )).toBeNull();
  });

  test('returns null when event already ended (defensive)', () => {
    const event = {
      startsAt: new Date('2026-04-20T10:00:00Z'),
      endsAt: new Date('2026-04-25T21:59:00Z'), // ended yesterday
      aiTime: undefined,
      source: 'meetup',
    };
    expect(formatOngoingDateLabel(event, 'en-GB', 'en')).toBeNull();
  });
});

describe('formatWelcome', () => {
  test('contains /today command', () => {
    expect(formatWelcome()).toContain('/today');
  });

  test('does not contain /search command', () => {
    expect(formatWelcome()).not.toContain('/search');
  });

  test('contains Ukrainian text with uk locale', () => {
    const welcome = formatWelcome('uk');
    expect(welcome).toContain('/today');
    expect(welcome).toContain('Події сьогодні');
  });
});
