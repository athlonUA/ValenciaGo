import { describe, test, expect } from 'vitest';
import { VisitValenciaAdapter } from './visitvalencia.js';

describe('VisitValenciaAdapter', () => {
  test('implements SourceAdapter interface', () => {
    const adapter = new VisitValenciaAdapter();
    expect(adapter.name).toBe('visitvalencia');
    expect(adapter.enabled).toBe(true);
    expect(typeof adapter.fetchEvents).toBe('function');
  });
});

// Date parsing is private but covers both ES ("Del ... al ...") and EN ("From ... to ...") layouts
// of the same .card__date element. We exercise it through a thin proxy.
describe('VisitValenciaAdapter date parsing', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parse = (text: string) => (new VisitValenciaAdapter() as any).parseDateRange(text);

  test('parses Spanish range with whitespace and newlines (Del ... al ...)', () => {
    const result = parse('Del \n                                25/04/2026\n                                            al 26/04/2026');
    expect(result.startDate).toContain('2026-04-25');
    expect(result.endDate).toContain('2026-04-26');
  });

  test('parses Spanish single-line range', () => {
    const result = parse('Del 18/11/2025 al 30/04/2026');
    expect(result.startDate).toContain('2025-11-18');
    expect(result.endDate).toContain('2026-04-30');
  });

  test('parses English range (legacy)', () => {
    const result = parse('From 25/04/2026 to 26/04/2026');
    expect(result.startDate).toContain('2026-04-25');
    expect(result.endDate).toContain('2026-04-26');
  });

  test('parses single date', () => {
    const result = parse('15/05/2026');
    expect(result.startDate).toContain('2026-05-15');
    expect(result.endDate).toBeNull();
  });

  test('returns nulls on empty input', () => {
    expect(parse('')).toEqual({ startDate: null, endDate: null });
  });

  test('returns nulls on unparseable input', () => {
    expect(parse('Coming soon')).toEqual({ startDate: null, endDate: null });
  });
});
