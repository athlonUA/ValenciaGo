import { describe, test, expect } from 'vitest';
import { resolveLocale, resolveLocaleWithOverride, isLocale, t, dateLocale, SUPPORTED_LOCALES, type TranslationKey } from './i18n.js';

describe('resolveLocale', () => {
  test('returns uk for "uk"', () => {
    expect(resolveLocale('uk')).toBe('uk');
  });

  test('returns uk for "uk-UA"', () => {
    expect(resolveLocale('uk-UA')).toBe('uk');
  });

  test('returns es for "es"', () => {
    expect(resolveLocale('es')).toBe('es');
  });

  test('returns es for "es-ES"', () => {
    expect(resolveLocale('es-ES')).toBe('es');
  });

  test('returns en for "en"', () => {
    expect(resolveLocale('en')).toBe('en');
  });

  test('returns en for "fr"', () => {
    expect(resolveLocale('fr')).toBe('en');
  });

  test('returns en for undefined', () => {
    expect(resolveLocale(undefined)).toBe('en');
  });

  test('returns en for empty string', () => {
    expect(resolveLocale('')).toBe('en');
  });
});

describe('resolveLocaleWithOverride', () => {
  test('uses saved locale when valid', () => {
    expect(resolveLocaleWithOverride('uk', 'en')).toBe('uk');
  });

  test('uses saved es over Telegram uk', () => {
    expect(resolveLocaleWithOverride('es', 'uk')).toBe('es');
  });

  test('falls back to Telegram language when saved is null', () => {
    expect(resolveLocaleWithOverride(null, 'uk')).toBe('uk');
  });

  test('falls back to en when both are null/undefined', () => {
    expect(resolveLocaleWithOverride(null, undefined)).toBe('en');
  });

  test('ignores invalid saved locale', () => {
    expect(resolveLocaleWithOverride('fr', 'es')).toBe('es');
  });
});

describe('isLocale', () => {
  test('returns true for supported locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('uk')).toBe(true);
    expect(isLocale('es')).toBe(true);
  });

  test('returns false for unsupported locales', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale('EN')).toBe(false);
  });
});

describe('SUPPORTED_LOCALES', () => {
  test('contains en, uk, es', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'uk', 'es']);
  });
});

describe('t', () => {
  test('returns English string', () => {
    expect(t('en', 'free')).toBe('Free');
  });

  test('returns Ukrainian string', () => {
    expect(t('uk', 'free')).toBe('Безкоштовно');
  });

  test('returns Spanish string', () => {
    expect(t('es', 'free')).toBe('Gratis');
  });

  test('interpolates single param', () => {
    expect(t('en', 'stats.total', { count: 42 })).toBe('Total events: 42');
  });

  test('interpolates multiple params', () => {
    expect(t('en', 'search.header', { query: 'jazz', count: 5 })).toBe('Search: "jazz" (5 found)');
  });

  test('preserves placeholder when param missing', () => {
    expect(t('en', 'stats.total', {})).toBe('Total events: {count}');
  });

  test('Ukrainian interpolation works', () => {
    expect(t('uk', 'likes.header', { total: 3 })).toBe('❤️ Збережені події (3)');
  });

  test('Spanish interpolation works', () => {
    expect(t('es', 'likes.header', { total: 5 })).toBe('❤️ Tus eventos guardados (5)');
  });
});

describe('dateLocale', () => {
  test('returns en-GB for en', () => {
    expect(dateLocale('en')).toBe('en-GB');
  });

  test('returns uk for uk', () => {
    expect(dateLocale('uk')).toBe('uk');
  });

  test('returns es for es', () => {
    expect(dateLocale('es')).toBe('es');
  });
});

describe('translation completeness', () => {
  const keys: TranslationKey[] = [
    'free', 'from', 'map', 'details', 'noEventsFound',
    'welcome.title', 'welcome.today', 'welcome.tomorrow', 'welcome.weekend',
    'welcome.week', 'welcome.free', 'welcome.category', 'welcome.likes',
    'welcome.lang',
    'events.today', 'events.tomorrow', 'events.weekend', 'events.freeThisWeek',
    'events.thisWeek', 'events.categoryWeek', 'events.noEvents',
    'events.hint.today', 'events.hint.tomorrow', 'events.hint.weekend',
    'events.hint.week', 'events.hint.free', 'events.unknownCategory',
    'misc.unknownCategory', 'misc.unknownCategoryNamed', 'misc.browseByCategory',
    'misc.eventNotFound', 'misc.deleteData',
    'stats.title', 'stats.total', 'stats.upcoming', 'stats.bySource', 'stats.byCategory',
    'likes.empty', 'likes.header', 'likes.saved', 'likes.removed',
    'search.noResults', 'search.noResultsSmart', 'search.header', 'search.found',
    'search.expired', 'search.voiceNotConfigured', 'search.voiceOwnerOnly',
    'search.voiceTooLong', 'search.voiceUnsupported', 'search.voiceNotUnderstood',
    'search.voiceSearching', 'search.voiceFailed', 'search.unknownCommand',
    'rateLimit.callback', 'rateLimit.message',
    'keyboard.prev', 'keyboard.next', 'keyboard.categories',
    'lang.choose', 'lang.set',
    'cmd.today', 'cmd.tomorrow', 'cmd.weekend', 'cmd.week', 'cmd.free',
    'cmd.category', 'cmd.likes', 'cmd.stats', 'cmd.lang',
  ];

  test('uk has all keys that en has', () => {
    for (const key of keys) {
      const en = t('en', key);
      const uk = t('uk', key);
      expect(en, `en.${key} should not be empty`).toBeTruthy();
      expect(uk, `uk.${key} should not be empty`).toBeTruthy();
      if (key !== 'welcome.title') {
        expect(uk, `uk.${key} should differ from en`).not.toBe(en);
      }
    }
  });

  test('es has all keys that en has', () => {
    for (const key of keys) {
      const en = t('en', key);
      const es = t('es', key);
      expect(en, `en.${key} should not be empty`).toBeTruthy();
      expect(es, `es.${key} should not be empty`).toBeTruthy();
      if (key !== 'welcome.title') {
        expect(es, `es.${key} should differ from en`).not.toBe(en);
      }
    }
  });
});
