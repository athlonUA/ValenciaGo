import { describe, test, expect } from 'vitest';
import {
  decodeHtmlEntities,
  stripHtml,
  normalizeTitle,
  fingerprintTitle,
  fingerprintVenue,
  truncateDescription,
  detectFree,
  normalizeUrl,
} from './normalize.js';

describe('decodeHtmlEntities', () => {
  test('decodes common named entities', () => {
    expect(decodeHtmlEntities('&amp;')).toBe('&');
    expect(decodeHtmlEntities('&lt;')).toBe('<');
    expect(decodeHtmlEntities('&gt;')).toBe('>');
    expect(decodeHtmlEntities('&quot;')).toBe('"');
    expect(decodeHtmlEntities('&#39;')).toBe("'");
    expect(decodeHtmlEntities('&nbsp;')).toBe(' ');
  });

  test('decodes multiple entities in one string', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry &lt;3')).toBe('Tom & Jerry <3');
  });

  test('passes through unknown entities unchanged', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
  });

  test('handles strings with no entities', () => {
    expect(decodeHtmlEntities('plain text')).toBe('plain text');
  });
});

describe('stripHtml', () => {
  test('removes HTML tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
  });

  test('collapses whitespace left by tags', () => {
    expect(stripHtml('<p>Hello</p>   <p>World</p>')).toBe('Hello World');
  });

  test('handles nested tags', () => {
    expect(stripHtml('<div><p><strong>Bold</strong> text</p></div>')).toBe('Bold text');
  });

  test('trims leading/trailing whitespace', () => {
    expect(stripHtml('  <br>  hello  <br>  ')).toBe('hello');
  });
});

describe('normalizeTitle', () => {
  test('trims whitespace', () => {
    expect(normalizeTitle('  Hello World  ')).toBe('Hello World');
  });

  test('decodes HTML entities', () => {
    expect(normalizeTitle('Rock &amp; Roll')).toBe('Rock & Roll');
  });

  test('collapses internal whitespace', () => {
    expect(normalizeTitle('Hello    World')).toBe('Hello World');
  });

  test('combines all normalizations', () => {
    expect(normalizeTitle('  Rock &amp; Roll   Live  ')).toBe('Rock & Roll Live');
  });
});

describe('fingerprintTitle', () => {
  test('strips accents', () => {
    expect(fingerprintTitle('café')).toBe('cafe');
  });

  test('removes punctuation', () => {
    expect(fingerprintTitle('Hello, World!')).toBe('hello world');
  });

  test('removes noise words (Spanish and English)', () => {
    const fp = fingerprintTitle('El concierto de la banda');
    expect(fp).not.toContain('el');
    expect(fp).not.toContain('de');
    expect(fp).not.toContain('la');
    expect(fp).toContain('concierto');
    expect(fp).toContain('banda');
  });

  test('removes English noise words', () => {
    const fp = fingerprintTitle('The best of the band');
    expect(fp).not.toContain('the');
    expect(fp).not.toContain('of');
    expect(fp).toContain('best');
    expect(fp).toContain('band');
  });

  test('sorts words alphabetically', () => {
    expect(fingerprintTitle('zebra apple mango')).toBe('apple mango zebra');
  });

  test('normalizes case', () => {
    expect(fingerprintTitle('HELLO World')).toBe('hello world');
  });

  test('filters single-character words', () => {
    const fp = fingerprintTitle('a b c hello');
    expect(fp).toBe('hello');
  });

  test('decodes entities before fingerprinting', () => {
    expect(fingerprintTitle('Rock &amp; Roll')).toBe('rock roll');
  });
});

describe('fingerprintVenue', () => {
  test('strips accents and punctuation', () => {
    expect(fingerprintVenue('Café del Arté')).toBe('cafe arte');
  });

  test('removes venue noise words', () => {
    const fp = fingerprintVenue('Centro Cultural La Beneficencia');
    expect(fp).not.toContain('centro');
    expect(fp).not.toContain('la');
    expect(fp).toContain('cultural');
    expect(fp).toContain('beneficencia');
  });

  test('removes "centre"', () => {
    const fp = fingerprintVenue('Centre de Cultura Contemporània');
    expect(fp).not.toContain('centre');
    expect(fp).toContain('cultura');
  });

  test('lowercases', () => {
    expect(fingerprintVenue('PALAU DE LES ARTS')).toBe('palau les arts');
  });
});

describe('truncateDescription', () => {
  test('passes through text under limit', () => {
    const short = 'This is short.';
    expect(truncateDescription(short, 300)).toBe(short);
  });

  test('truncates at sentence boundary when possible', () => {
    const text = 'First sentence. Second sentence. ' + 'x'.repeat(300);
    const result = truncateDescription(text, 50);
    expect(result).toBe('First sentence. Second sentence.');
    expect(result.length).toBeLessThanOrEqual(50);
  });

  test('falls back to word boundary with ellipsis', () => {
    const text = 'word '.repeat(100);
    const result = truncateDescription(text, 30);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(33); // 30 + '...'
  });

  test('strips HTML before truncating', () => {
    const text = '<p>Hello <strong>world</strong></p>';
    expect(truncateDescription(text)).toBe('Hello world');
  });

  test('decodes entities before truncating', () => {
    const text = 'Tom &amp; Jerry';
    expect(truncateDescription(text)).toBe('Tom & Jerry');
  });
});

describe('detectFree', () => {
  test('detects English "Free"', () => {
    expect(detectFree('Free entry')).toBe(true);
    expect(detectFree('free')).toBe(true);
  });

  test('detects Spanish free patterns', () => {
    expect(detectFree('Gratis')).toBe(true);
    expect(detectFree('Evento gratuito')).toBe(true);
    expect(detectFree('entrada libre')).toBe(true);
    expect(detectFree('sin coste')).toBe(true);
  });

  test('detects free in description when priceInfo is absent', () => {
    expect(detectFree(undefined, 'This event is free for all')).toBe(true);
  });

  test('returns false for prices', () => {
    expect(detectFree('€10')).toBe(false);
    expect(detectFree('$20 per person')).toBe(false);
  });

  test('returns false for empty input', () => {
    expect(detectFree()).toBe(false);
    expect(detectFree(undefined, undefined)).toBe(false);
    expect(detectFree('')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  test('removes tracking parameters', () => {
    const url = 'https://example.com/event?utm_source=fb&utm_medium=social&id=123';
    const result = normalizeUrl(url);
    expect(result).toContain('id=123');
    expect(result).not.toContain('utm_source');
    expect(result).not.toContain('utm_medium');
  });

  test('removes fbclid', () => {
    const url = 'https://example.com/event?fbclid=abc123';
    const result = normalizeUrl(url);
    expect(result).not.toContain('fbclid');
  });

  test('cleans trailing slashes', () => {
    const url = 'https://example.com/event/';
    const result = normalizeUrl(url);
    expect(result).toBe('https://example.com/event');
  });

  test('preserves root path slash', () => {
    const url = 'https://example.com/';
    const result = normalizeUrl(url);
    expect(result).toBe('https://example.com/');
  });

  test('returns invalid URL as-is', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});
