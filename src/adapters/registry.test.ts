import { describe, test, expect } from 'vitest';
import { createAdapters } from './registry.js';

describe('createAdapters', () => {
  test('returns 6 adapters', () => {
    const adapters = createAdapters({});
    expect(adapters).toHaveLength(6);
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
    expect(names).toEqual(['eventbrite', 'ivc', 'meetup', 'valenciacf', 'valenciaes', 'visitvalencia']);
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

  test('non-eventbrite, non-valenciaes adapters are always enabled', () => {
    // valenciaes is currently disabled (Liferay portlet requires JS execution).
    const adapters = createAdapters({});
    const others = adapters.filter(a => a.name !== 'eventbrite' && a.name !== 'valenciaes');
    expect(others).toHaveLength(4);
    for (const adapter of others) {
      expect(adapter.enabled).toBe(true);
    }
  });
});
