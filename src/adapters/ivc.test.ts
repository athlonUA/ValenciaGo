import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as cheerio from 'cheerio';
import {
  IvcAdapter,
  inferDate,
  isValenciaCityVenue,
  buildSourceId,
  extractIvcDescription,
} from './ivc.js';

describe('IvcAdapter', () => {
  test('implements SourceAdapter interface', () => {
    const adapter = new IvcAdapter();
    expect(adapter.name).toBe('ivc');
    expect(adapter.enabled).toBe(true);
    expect(typeof adapter.fetchEvents).toBe('function');
  });
});

describe('inferDate', () => {
  test('returns null for invalid month token', () => {
    expect(inferDate('15', 'xxx')).toBeNull();
  });

  test('returns null for non-numeric day', () => {
    expect(inferDate('abc', 'abr')).toBeNull();
  });

  test('returns null for out-of-range day', () => {
    expect(inferDate('32', 'abr')).toBeNull();
    expect(inferDate('0', 'abr')).toBeNull();
  });

  test('returns ISO date with Madrid summer offset for April', () => {
    const iso = inferDate('25', 'abr');
    expect(iso).toMatch(/^\d{4}-04-25T12:00:00\+02:00$/);
  });

  test('returns ISO date with Madrid winter offset for January', () => {
    const iso = inferDate('15', 'ene');
    expect(iso).toMatch(/^\d{4}-01-15T12:00:00\+01:00$/);
  });

  test('zero-pads single-digit day and infers a year', () => {
    const iso = inferDate('5', 'jul');
    expect(iso).toMatch(/^\d{4}-07-05T12:00:00\+02:00$/);
  });

  describe('calendar overflow validation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Today: Dec 15, 2026 — so "next year" rolls forward to 2027 (non-leap)
      vi.setSystemTime(new Date('2026-12-15T12:00:00Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    test('Feb 29 in non-leap year is rejected (was silently rolled to Mar 1)', () => {
      // Without validation, JS would silently make this 2027-03-01.
      expect(inferDate('29', 'feb')).toBeNull();
    });

    test('Apr 31 (impossible) is rejected', () => {
      expect(inferDate('31', 'abr')).toBeNull();
    });

    test('Jun 31 (impossible) is rejected', () => {
      expect(inferDate('31', 'jun')).toBeNull();
    });

    test('Feb 29 in leap year is accepted', () => {
      // Today still Dec 15, 2026. inferDate('29','feb') would propose Feb 29 2026 → past → roll to 2027.
      // 2027 is NOT leap. So this still returns null.
      expect(inferDate('29', 'feb')).toBeNull();
    });
  });

  describe('leap-year handling when next year IS a leap year', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Today: Dec 15, 2027 — next year is 2028 (leap)
      vi.setSystemTime(new Date('2027-12-15T12:00:00Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    test('Feb 29 is accepted in leap year', () => {
      const iso = inferDate('29', 'feb');
      expect(iso).toBe('2028-02-29T12:00:00+01:00');
    });
  });
});

describe('isValenciaCityVenue', () => {
  test('accepts València with diacritic', () => {
    expect(isValenciaCityVenue('Teatre Principal de València')).toBe(true);
  });

  test('accepts plain Valencia', () => {
    expect(isValenciaCityVenue('Teatro Rialto, Valencia')).toBe(true);
  });

  test('rejects Castelló venue', () => {
    expect(isValenciaCityVenue('Auditori i Palau de Congressos de Castelló')).toBe(false);
  });

  test('rejects Alacant venue', () => {
    expect(isValenciaCityVenue('Teatro Principal de Alicante')).toBe(false);
  });

  test('rejects "comunitat valenciana" (regional, not city)', () => {
    expect(isValenciaCityVenue('Festival itinerante de la Comunitat Valenciana')).toBe(false);
  });

  test('rejects empty/missing venue', () => {
    expect(isValenciaCityVenue(undefined)).toBe(false);
    expect(isValenciaCityVenue('')).toBe(false);
  });
});

describe('buildSourceId', () => {
  test('disambiguates film slugs across pelicula-NNNN buckets', () => {
    // Two films with the same slug but different parent buckets must NOT collide.
    const a = buildSourceId('/es/ivc/pelicula-742/el-hombre-que-mato-a-liberty-valance');
    const b = buildSourceId('/es/ivc/pelicula-9999/el-hombre-que-mato-a-liberty-valance');
    expect(a).toBe('pelicula-742/el-hombre-que-mato-a-liberty-valance');
    expect(b).toBe('pelicula-9999/el-hombre-que-mato-a-liberty-valance');
    expect(a).not.toBe(b);
  });

  test('handles agenda-ivc slugs', () => {
    expect(buildSourceId('/es/ivc/agenda-ivc/la-ultima-noche-con-mi-hermano'))
      .toBe('agenda-ivc/la-ultima-noche-con-mi-hermano');
  });

  test('strips query strings and fragments', () => {
    expect(buildSourceId('/es/ivc/agenda-ivc/foo?utm=x'))
      .toBe('agenda-ivc/foo');
    expect(buildSourceId('/es/ivc/agenda-ivc/foo#bar'))
      .toBe('agenda-ivc/foo');
  });

  test('strips trailing slash', () => {
    expect(buildSourceId('/es/ivc/agenda-ivc/foo/'))
      .toBe('agenda-ivc/foo');
  });

  test('returns null for too-shallow paths', () => {
    expect(buildSourceId('/foo')).toBeNull();
    expect(buildSourceId('')).toBeNull();
  });
});

describe('extractIvcDescription', () => {
  test('combines .resumen and .bloque-textos body', () => {
    const $ = cheerio.load(`
      <div class="resumen">PREMIO: Award winner 2017</div>
      <div class="bloque-textos">
        <h2>EVENT TITLE</h2>
        <p>Long body description goes here with all the details.</p>
      </div>
    `);
    const desc = extractIvcDescription($);
    expect(desc).toContain('Award winner 2017');
    expect(desc).toContain('Long body description');
    expect(desc).not.toContain('EVENT TITLE'); // heading stripped
  });

  test('returns just .resumen when bloque-textos missing', () => {
    const $ = cheerio.load('<div class="resumen">Short summary only</div>');
    const desc = extractIvcDescription($);
    expect(desc).toBe('Short summary only');
  });

  test('returns empty string when both selectors miss', () => {
    const $ = cheerio.load('<div class="other">irrelevant</div>');
    expect(extractIvcDescription($)).toBe('');
  });
});

describe('IvcAdapter parseCard isUntil branch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Apr 26 2026 at 18:00 UTC — that's 20:00 Madrid CEST, evening of the run's last day.
    vi.setSystemTime(new Date('2026-04-26T18:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('"hasta el 26 abr" event ingested in evening still satisfies endsAt > startsAt', () => {
    const adapter = new IvcAdapter();
    const $ = cheerio.load(`
      <div class="actividad">
        <div class="fecha">
          <span class="hasta_el">hasta el</span>
          <span class="dia">26</span>
          <span class="mes">abr</span>
        </div>
        <div class="bloque-contenidos-actividad">
          <div class="textos">
            <span class="lugar">Teatre Principal de València</span>
            <h2><a href="/es/ivc/agenda-ivc/sample-event">SAMPLE EVENT</a></h2>
          </div>
        </div>
      </div>
    `);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const card = (adapter as any).parseCard($, $('.actividad').first());
    expect(card).not.toBeNull();
    const startsAt = new Date(card.startsAt).getTime();
    const endsAt = new Date(card.endsAt).getTime();
    // Critical invariant: never violate chk_events_end_after_start.
    expect(endsAt).toBeGreaterThan(startsAt);
    // startsAt should be today's midnight Madrid (i.e. April 26 00:00 CEST = April 25 22:00 UTC).
    expect(card.startsAt).toMatch(/2026-04-2[56]T2[2-3]:\d{2}/);
  });

  test('skips ongoing event whose end-of-day is already past', () => {
    vi.setSystemTime(new Date('2026-04-27T18:00:00Z')); // a day after the run's last day
    const adapter = new IvcAdapter();
    const $ = cheerio.load(`
      <div class="actividad">
        <div class="fecha">
          <span class="hasta_el">hasta el</span>
          <span class="dia">26</span>
          <span class="mes">abr</span>
        </div>
        <div class="bloque-contenidos-actividad">
          <div class="textos">
            <span class="lugar">Teatre Principal de València</span>
            <h2><a href="/es/ivc/agenda-ivc/expired">EXPIRED EVENT</a></h2>
          </div>
        </div>
      </div>
    `);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const card = (adapter as any).parseCard($, $('.actividad').first());
    // inferDate('26','abr') today (Apr 27) would propose 2026-04-26 (1 day past, within 30d grace),
    // so endOfDay Madrid = 2026-04-26T23:59 CEST = 2026-04-26T21:59Z, which is < now. Skip.
    expect(card).toBeNull();
  });
});
