import { describe, expect, test } from 'vitest';
import { addDays, currentStreak, currentStreakFromDescending, isValidDate } from './streak';
import { normalizeHabitName } from './habitName';

const T = '2026-11-18';

describe('currentStreak (pure)', () => {
  test('no logs is 0', () => {
    expect(currentStreak([], T)).toBe(0);
  });
  test('today only is 1', () => {
    expect(currentStreak([T], T)).toBe(1);
  });
  test('yesterday only is 1 (still alive)', () => {
    expect(currentStreak(['2026-11-17'], T)).toBe(1);
  });
  test('day before yesterday only is 0', () => {
    expect(currentStreak(['2026-11-16'], T)).toBe(0);
  });
  test('duplicate dates count once', () => {
    expect(currentStreak([T, T, '2026-11-17', '2026-11-17'], T)).toBe(2);
  });
  test('gap stops the streak', () => {
    expect(currentStreak([T, '2026-11-17', '2026-11-15', '2026-11-14'], T)).toBe(2);
  });
  test('gap ending yesterday', () => {
    expect(currentStreak(['2026-11-17', '2026-11-16', '2026-11-14'], T)).toBe(2);
  });
  test('future dates ignored', () => {
    expect(currentStreak(['2026-11-19', T], T)).toBe(1);
  });
  test('unordered input', () => {
    expect(currentStreak(['2026-11-16', T, '2026-11-17'], T)).toBe(3);
  });
  test('crosses month, year and leap day', () => {
    expect(currentStreak(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01')).toBe(3);
    expect(currentStreak(['2025-12-31', '2026-01-01'], '2026-01-01')).toBe(2);
  });
  test('descending variant matches', async () => {
    expect(await currentStreakFromDescending([T, '2026-11-17', '2026-11-15'], T)).toBe(2);
  });
  test('invalid today throws', () => {
    expect(() => currentStreak([], '2026-02-30')).toThrow();
    expect(() => currentStreak([], '2026-1-01')).toThrow();
  });
  test('addDays and isValidDate', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2025-02-29')).toBe(false);
  });
});

describe('normalizeHabitName (pure)', () => {
  test('trims', () => expect(normalizeHabitName('  Read  ')).toBe('Read'));
  test('empty and whitespace throw', () => {
    expect(() => normalizeHabitName('')).toThrow();
    expect(() => normalizeHabitName('   \n\t ')).toThrow();
  });
  test('60 ok, 61 throws', () => {
    expect(normalizeHabitName('a'.repeat(60))).toHaveLength(60);
    expect(() => normalizeHabitName('a'.repeat(61))).toThrow();
  });
  test('61 chars padded with spaces is ok after trim', () => {
    expect(normalizeHabitName(` ${'a'.repeat(60)} `)).toHaveLength(60);
  });
  test('60 emoji characters are within the 60-character limit', () => {
    // Spec: "1-60 characters". 60 user-visible characters should be accepted.
    expect(() => normalizeHabitName('🏃'.repeat(60))).not.toThrow();
  });
});
