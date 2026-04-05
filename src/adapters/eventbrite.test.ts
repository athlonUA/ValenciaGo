import { describe, test, expect } from 'vitest';
import { EventbriteAdapter } from './eventbrite.js';

describe('EventbriteAdapter', () => {
  test('disabled without token', () => {
    const adapter = new EventbriteAdapter(undefined);
    expect(adapter.name).toBe('eventbrite');
    expect(adapter.enabled).toBe(false);
  });

  test('disabled with empty string token', () => {
    const adapter = new EventbriteAdapter('');
    expect(adapter.name).toBe('eventbrite');
    expect(adapter.enabled).toBe(false);
  });

  test('enabled with token', () => {
    const adapter = new EventbriteAdapter('test-token');
    expect(adapter.name).toBe('eventbrite');
    expect(adapter.enabled).toBe(true);
  });

  test('fetchEvents returns empty array when disabled', async () => {
    const adapter = new EventbriteAdapter(undefined);
    const events = await adapter.fetchEvents();
    expect(events).toEqual([]);
  });
});
