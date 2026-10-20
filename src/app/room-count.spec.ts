import { describe, expect, test } from 'vitest';
import { ROOM_MAX, ROOM_MIN } from './engine/model';
import { ROOM_FALLBACK, normalizeRoomCount, stepRoomCount } from './room-count';

describe('room count normalization', () => {
  test('normalizes drafts to an in-range whole number', () => {
    expect(normalizeRoomCount('6')).toBe(6);
    expect(normalizeRoomCount('')).toBe(ROOM_FALLBACK);
    expect(normalizeRoomCount('   ')).toBe(ROOM_FALLBACK);
    expect(normalizeRoomCount('abc')).toBe(ROOM_FALLBACK);
    expect(normalizeRoomCount('4.5')).toBe(4);
    expect(normalizeRoomCount('3')).toBe(ROOM_MIN);
    expect(normalizeRoomCount('9')).toBe(ROOM_MAX);
    expect(normalizeRoomCount('-2')).toBe(ROOM_MIN);
    expect(normalizeRoomCount('12')).toBe(ROOM_MAX);
  });

  test('stepping stays within bounds and matches the normalized draft', () => {
    expect(stepRoomCount('6', 1)).toBe('7');
    expect(stepRoomCount('6', -1)).toBe('5');
    expect(stepRoomCount('', 1)).toBe('7');
    expect(stepRoomCount('', -1)).toBe('5');
    expect(stepRoomCount('4.5', 1)).toBe('5');
    expect(stepRoomCount('4.5', -1)).toBe('4');
    expect(stepRoomCount('4', -1)).toBe('4');
    expect(stepRoomCount('8', 1)).toBe('8');
    expect(stepRoomCount('4', 1)).toBe('5');
    expect(stepRoomCount('8', -1)).toBe('7');
  });
});
