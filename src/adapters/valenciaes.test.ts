import { describe, test, expect } from 'vitest';
import { ValenciaEsAdapter } from './valenciaes.js';

describe('ValenciaEsAdapter', () => {
  test('implements SourceAdapter interface', () => {
    const adapter = new ValenciaEsAdapter();
    expect(adapter.name).toBe('valenciaes');
    // Disabled until we can render JS / hit the portlet resource phase.
    expect(adapter.enabled).toBe(false);
    expect(typeof adapter.fetchEvents).toBe('function');
  });

  test('fetchEvents short-circuits when disabled (does not hit network)', async () => {
    const adapter = new ValenciaEsAdapter();
    // If the guard at the top of fetchEvents is removed, this test would attempt a real
    // HTTP request and either time out or hit the live site. Guard keeps it instant.
    const start = Date.now();
    const events = await adapter.fetchEvents();
    expect(events).toEqual([]);
    expect(Date.now() - start).toBeLessThan(100);
  });
});
