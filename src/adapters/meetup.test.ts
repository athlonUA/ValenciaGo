import { describe, test, expect } from 'vitest';
import { MeetupAdapter } from './meetup.js';

describe('MeetupAdapter', () => {
  test('implements SourceAdapter interface', () => {
    const adapter = new MeetupAdapter();
    expect(adapter.name).toBe('meetup');
    expect(adapter.enabled).toBe(true);
    expect(typeof adapter.fetchEvents).toBe('function');
  });
});
