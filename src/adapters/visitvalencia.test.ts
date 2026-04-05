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
