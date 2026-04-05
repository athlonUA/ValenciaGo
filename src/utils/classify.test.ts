import { describe, test, expect } from 'vitest';
import { classifyEvent } from './classify.js';
import { EventCategory } from '../types/category.js';

describe('classifyEvent', () => {
  describe('music events', () => {
    test('classifies "concierto de jazz" as music', () => {
      const result = classifyEvent('concierto de jazz');
      expect(result.category).toBe(EventCategory.MUSIC);
    });

    test('classifies "live rock band" as music', () => {
      const result = classifyEvent('live rock band');
      expect(result.category).toBe(EventCategory.MUSIC);
    });
  });

  describe('sports events', () => {
    test('classifies "Valencia CF vs Real Madrid" as sports', () => {
      // "futbol" keyword won't be in the title, but description helps
      const result = classifyEvent('valencia cf vs real madrid', 'Partido de fútbol en Mestalla');
      expect(result.category).toBe(EventCategory.SPORTS);
    });

    test('classifies "Partido de fútbol" as sports', () => {
      const result = classifyEvent('partido de futbol');
      expect(result.category).toBe(EventCategory.SPORTS);
    });
  });

  describe('theater events', () => {
    test('classifies theater events as performing arts', () => {
      const result = classifyEvent('teatro obra dramatica');
      expect(result.category).toBe(EventCategory.PERFORMING);
    });
  });

  describe('food events', () => {
    test('classifies "wine tasting" as food', () => {
      const result = classifyEvent('wine tasting');
      expect(result.category).toBe(EventCategory.FOOD);
    });

    test('classifies "Cata de vinos" as food', () => {
      const result = classifyEvent('cata de vinos');
      expect(result.category).toBe(EventCategory.FOOD);
    });
  });

  describe('tech events', () => {
    test('classifies "JavaScript meetup" as tech or networking', () => {
      const result = classifyEvent('javascript meetup');
      // "javascript" is a tech keyword, "meetup" is networking
      // tech should win or at least be in tags
      expect(result.tags).toContain(EventCategory.TECH);
    });
  });

  describe('unknown events', () => {
    test('returns OTHER with confidence 0 for random gibberish', () => {
      const result = classifyEvent('xyzzy plugh qwerty');
      expect(result.category).toBe(EventCategory.OTHER);
      expect(result.confidence).toBe(0);
      expect(result.tags).toEqual([]);
    });
  });

  describe('confidence', () => {
    test('title match has higher confidence than description-only match', () => {
      const titleResult = classifyEvent('concierto jazz musica');
      const descResult = classifyEvent('evento especial', 'concierto jazz musica');
      expect(titleResult.confidence).toBeGreaterThan(descResult.confidence);
    });
  });

  describe('tags', () => {
    test('includes multiple matching categories in tags', () => {
      // "live jazz" hits music; "tasting wine" hits food
      const result = classifyEvent('live jazz wine tasting');
      expect(result.tags.length).toBeGreaterThanOrEqual(2);
      expect(result.tags).toContain(EventCategory.MUSIC);
      expect(result.tags).toContain(EventCategory.FOOD);
    });
  });
});
