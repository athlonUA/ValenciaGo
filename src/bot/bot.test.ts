import { describe, test, expect } from 'vitest';

describe('createBot', () => {
  test('exports createBot as a function', async () => {
    const mod = await import('./bot.js');
    expect(typeof mod.createBot).toBe('function');
  });
});
