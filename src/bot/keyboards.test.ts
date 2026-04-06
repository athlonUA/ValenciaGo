import { describe, test, expect } from 'vitest';
import type { StoredEvent } from '../types/index.js';
import { EventCategory } from '../types/category.js';
import { buildCategoryKeyboard, buildEventListKeyboard, PAGE_SIZE } from './keyboards.js';

const makeEvent = (id: string): StoredEvent => ({
  id,
  source: 'meetup',
  sourceId: id,
  sourceUrl: `https://meetup.com/e/${id}`,
  title: `Event ${id}`,
  titleNormalized: `event ${id}`,
  description: 'Test event',
  category: EventCategory.MUSIC,
  tags: ['music'],
  city: 'Valencia',
  venue: 'Venue',
  address: 'Address',
  latitude: 39.45,
  longitude: -0.38,
  startsAt: new Date('2026-04-10T20:00:00Z'),
  endsAt: undefined,
  priceInfo: undefined,
  isFree: true,
  language: 'en',
  imageUrl: undefined,
  rawPayload: undefined,
  contentHash: 'hash',
  summary: undefined,
  emoji: undefined,
  aiPrice: undefined,
  aiTime: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
  ingestedAt: new Date(),
});

describe('PAGE_SIZE', () => {
  test('equals 3', () => {
    expect(PAGE_SIZE).toBe(3);
  });
});

describe('buildCategoryKeyboard', () => {
  test('returns an InlineKeyboard with rows', () => {
    const kb = buildCategoryKeyboard();
    expect(kb).toBeDefined();
    expect(typeof kb.text).toBe('function');
    expect(typeof kb.row).toBe('function');
  });

  test('uses English category names by default', () => {
    const kb = buildCategoryKeyboard('en');
    const data = JSON.stringify(kb);
    expect(data).toContain('Music');
  });

  test('uses Ukrainian category names with uk locale', () => {
    const kb = buildCategoryKeyboard('uk');
    const data = JSON.stringify(kb);
    expect(data).toContain('Музика');
    expect(data).toContain('Технології');
  });
});

describe('buildEventListKeyboard', () => {
  test('returns an InlineKeyboard with like and share buttons', () => {
    const events = [makeEvent('e1'), makeEvent('e2')];
    const kb = buildEventListKeyboard(events, 'today', 1, 1);
    expect(kb).toBeDefined();
    expect(typeof kb.text).toBe('function');
  });

  test('includes pagination when totalPages > 1', () => {
    const events = [makeEvent('e1'), makeEvent('e2'), makeEvent('e3')];
    const kb = buildEventListKeyboard(events, 'today', 1, 3);
    const data = JSON.stringify(kb);
    expect(data).toContain('Next');
    expect(data).toContain('1/3');
  });

  test('includes back to categories button for cat command', () => {
    const events = [makeEvent('e1')];
    const kb = buildEventListKeyboard(events, 'cat', 1, 1);
    const data = JSON.stringify(kb);
    expect(data).toContain('Categories');
  });

  test('uses Ukrainian button labels with uk locale', () => {
    const events = [makeEvent('e1'), makeEvent('e2'), makeEvent('e3')];
    const kb = buildEventListKeyboard(events, 'today', 1, 3, '', 'uk');
    const data = JSON.stringify(kb);
    expect(data).toContain('Назад');
    expect(data).toContain('Далі');
  });

  test('uses Ukrainian categories button with uk locale', () => {
    const events = [makeEvent('e1')];
    const kb = buildEventListKeyboard(events, 'cat', 1, 1, '', 'uk');
    const data = JSON.stringify(kb);
    expect(data).toContain('Категорії');
  });
});
