import { GENERATOR_VERSION } from './model';
import type { Dungeon, Room, Connection } from './model';
import { hashSeed } from './random';
import { createLayout } from './topology';

export function showcaseDungeon(): Dungeon {
  const rooms: Room[] = [
    { id: 0, x: 4, y: 4, width: 9, height: 7 },
    { id: 1, x: 24, y: 5, width: 8, height: 6 },
    { id: 2, x: 17, y: 20, width: 9, height: 6 },
  ];
  const connections: Connection[] = [
    { from: 0, to: 1, bend: 'vertical' },
    { from: 1, to: 2, bend: 'horizontal' },
  ];
  return {
    version: GENERATOR_VERSION,
    seed: 'showcase',
    surfaceSeed: hashSeed('showcase:surface'),
    layout: createLayout(rooms, connections),
    decoration: {
      density: 'Balanced',
      revision: 0,
      props: [
        { x: 5, y: 5, kind: 'crate', blocking: true, variation: 0.2 },
        { x: 6, y: 5, kind: 'barrel', blocking: true, variation: 0.6 },
        { x: 11, y: 9, kind: 'rubble', blocking: true, variation: 0.4 },
        { x: 27, y: 8, kind: 'rug', blocking: false, variation: 0.2 },
        { x: 25, y: 5, kind: 'sconce', blocking: false, variation: 0.1 },
        { x: 18, y: 20, kind: 'moss', blocking: false, variation: 0.4 },
        { x: 18, y: 21, kind: 'barrel', blocking: true, variation: 0.2 },
        { x: 23, y: 20, kind: 'sconce', blocking: false, variation: 0.2 },
      ],
    },
  };
}
