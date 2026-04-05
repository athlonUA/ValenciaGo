import { describe, test, expect } from 'vitest';
import { ValenciaCFAdapter } from './valenciacf.js';

describe('ValenciaCFAdapter', () => {
  test('implements SourceAdapter interface', () => {
    const adapter = new ValenciaCFAdapter();
    expect(adapter.name).toBe('valenciacf');
    expect(adapter.enabled).toBe(true);
    expect(typeof adapter.fetchEvents).toBe('function');
  });
});
