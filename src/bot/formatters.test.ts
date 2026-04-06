import { describe, test, expect } from 'vitest';
import type { StoredEvent } from '../types/index.js';
import { EventCategory } from '../types/category.js';
import { formatEventCard, formatEventList, formatWelcome } from './formatters.js';

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
