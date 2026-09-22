import { describe, expect, it } from 'vitest';
import { formatDate } from '../scripts/date-format';

describe('formatDate', () => {
  it('formats YYYY-MM as short month + year', () => {
    expect(formatDate('2025-05')).toBe('May 2025');
  });

  it('passes a bare year through unchanged', () => {
    expect(formatDate('2021')).toBe('2021');
  });

  it('handles December without an off-by-one', () => {
    expect(formatDate('2024-12')).toBe('Dec 2024');
  });
});
