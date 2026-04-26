import { describe, test, expect } from 'vitest';
import { isAllowedUrl } from './url.js';

describe('isAllowedUrl', () => {
  // --- meetup ---
  test('allows valid meetup URL', () => {
    expect(isAllowedUrl('https://www.meetup.com/group/events/123', 'meetup')).toBe(true);
  });

  test('allows meetup.com without www', () => {
    expect(isAllowedUrl('https://meetup.com/group/events/123', 'meetup')).toBe(true);
  });

  // --- eventbrite ---
  test('allows valid eventbrite.com URL', () => {
    expect(isAllowedUrl('https://www.eventbrite.com/e/123', 'eventbrite')).toBe(true);
  });

  test('allows eventbrite.es', () => {
    expect(isAllowedUrl('https://www.eventbrite.es/e/123', 'eventbrite')).toBe(true);
  });

  test('allows eventbriteapi.com', () => {
    expect(isAllowedUrl('https://www.eventbriteapi.com/v3/events/123/', 'eventbrite')).toBe(true);
  });

  // --- visitvalencia ---
  test('allows visitvalencia URL', () => {
    expect(isAllowedUrl('https://www.visitvalencia.com/en/events-valencia/fallas', 'visitvalencia')).toBe(true);
  });

  // --- valenciacf ---
  test('allows valenciacf domain', () => {
    expect(isAllowedUrl('https://www.valenciacf.com/matches/123', 'valenciacf')).toBe(true);
  });

  test('allows valenciacf without www', () => {
    expect(isAllowedUrl('https://valenciacf.com/results', 'valenciacf')).toBe(true);
  });

  // --- valenciaes ---
  test('allows valencia.es agenda detail page', () => {
    expect(isAllowedUrl('https://www.valencia.es/cas/agenda-de-la-ciudad/-/content/tastarros-2026', 'valenciaes')).toBe(true);
  });

  test('allows valencia.es without www', () => {
    expect(isAllowedUrl('https://valencia.es/anything', 'valenciaes')).toBe(true);
  });

  test('rejects unrelated host for valenciaes', () => {
    expect(isAllowedUrl('https://valencia.evil.com/agenda', 'valenciaes')).toBe(false);
  });

  // --- ivc ---
  test('allows ivc.gva.es agenda detail page', () => {
    expect(isAllowedUrl('https://ivc.gva.es/es/ivc/agenda-ivc/example-event', 'ivc')).toBe(true);
  });

  test('rejects unrelated gva.es subdomain for ivc', () => {
    expect(isAllowedUrl('https://www.gva.es/somethingelse', 'ivc')).toBe(false);
  });

  // --- rejection cases ---
  test('rejects unknown domain for meetup source', () => {
    expect(isAllowedUrl('https://evil.com/hack', 'meetup')).toBe(false);
  });

  test('rejects localhost', () => {
    expect(isAllowedUrl('http://localhost:5432', 'meetup')).toBe(false);
  });

  test('rejects internal IP', () => {
    expect(isAllowedUrl('http://192.168.1.1/admin', 'visitvalencia')).toBe(false);
  });

  test('rejects unknown source name', () => {
    expect(isAllowedUrl('https://www.meetup.com/events', 'unknown')).toBe(false);
  });

  test('handles invalid URL gracefully', () => {
    expect(isAllowedUrl('not-a-url', 'meetup')).toBe(false);
  });

  test('handles empty string URL', () => {
    expect(isAllowedUrl('', 'meetup')).toBe(false);
  });

  test('rejects cross-source domain (meetup URL for eventbrite source)', () => {
    expect(isAllowedUrl('https://www.meetup.com/events/123', 'eventbrite')).toBe(false);
  });
});
