import { describe, test, expect } from 'vitest';
import { createAdapters } from './registry.js';

describe('createAdapters', () => {
  test('returns 4 adapters', () => {
    const adapters = createAdapters({});
    expect(adapters).toHaveLength(4);
  });

  test('all adapters have name and fetchEvents', () => {
    const adapters = createAdapters({});
    for (const adapter of adapters) {
      expect(adapter.name).toBeTruthy();
      expect(typeof adapter.fetchEvents).toBe('function');
    }
  });

  test('includes all expected adapter names', () => {
    const adapters = createAdapters({});
    const names = adapters.map(a => a.name).sort();
    expect(names).toEqual(['eventbrite', 'meetup', 'valenciacf', 'visitvalencia']);
  });

  test('eventbrite disabled without token', () => {
    const adapters = createAdapters({});
    const eb = adapters.find(a => a.name === 'eventbrite');
    expect(eb?.enabled).toBe(false);
  });

  test('eventbrite enabled with token', () => {
    const adapters = createAdapters({ eventbriteToken: 'test' });
    const eb = adapters.find(a => a.name === 'eventbrite');
    expect(eb?.enabled).toBe(true);
  });

  test('non-eventbrite adapters are always enabled', () => {
    const adapters = createAdapters({});
    const others = adapters.filter(a => a.name !== 'eventbrite');
    expect(others).toHaveLength(3);
    for (const adapter of others) {
      expect(adapter.enabled).toBe(true);
    }
  });
});
