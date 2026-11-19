import type { Prop, QuarterTurn } from '../model';

/** Omit the default orientation so four turns restore the original document. */
export function withObjectRotation(prop: Prop, rotation: QuarterTurn): Prop {
  const { artRotation: _rotation, ...rest } = prop;
  return rotation ? { ...rest, artRotation: rotation } : rest;
}
export function validStoredRotation(value: Record<string, unknown>): boolean {
  return value['artRotation'] === undefined || [1, 2, 3].includes(value['artRotation'] as number);
}
