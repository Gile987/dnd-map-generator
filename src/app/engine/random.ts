import { GENERATOR_VERSION } from './model';

export function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

export type SeedStream =
  'layout' | 'decoration' | 'surface' | 'forest-layout' | 'forest-decoration';

export function streamSeed(seed: string, kind: SeedStream, ...parts: (string | number)[]): number {
  return hashSeed([GENERATOR_VERSION, seed, kind, ...parts].join(':'));
}

export function deriveSeed(base: number, ...parts: (string | number)[]): number {
  return hashSeed([base, ...parts].join(':'));
}

export class Random {
  constructor(private state: number) {}

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let value = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

export function shuffleInPlace<T>(items: NonNullable<T>[], random: Pick<Random, 'int'>): void {
  for (let i = items.length - 1; i > 0; i--) {
    const swap = random.int(0, i);
    const a = items[i];
    const b = items[swap];
    if (a !== undefined && b !== undefined) {
      items[i] = b;
      items[swap] = a;
    }
  }
}
