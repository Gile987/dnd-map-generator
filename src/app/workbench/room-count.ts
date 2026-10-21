import { ROOM_MAX, ROOM_MIN } from '../engine/model';

export const ROOM_FALLBACK = 6;

export function normalizeRoomCount(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return ROOM_FALLBACK;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return ROOM_FALLBACK;
  return Math.min(ROOM_MAX, Math.max(ROOM_MIN, Math.floor(parsed)));
}

export function stepRoomCount(value: string, delta: number): string {
  return String(Math.min(ROOM_MAX, Math.max(ROOM_MIN, normalizeRoomCount(value) + delta)));
}
