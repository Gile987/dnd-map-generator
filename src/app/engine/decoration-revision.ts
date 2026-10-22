export function isDetailRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function nextDetailRevision(revision: number): number {
  if (!isDetailRevision(revision)) throw new Error('This map has an invalid detail revision.');
  if (revision === Number.MAX_SAFE_INTEGER)
    throw new Error(
      'This map has reached the detail revision limit. Change the seed to generate a new layout before shuffling again.',
    );
  return revision + 1;
}
