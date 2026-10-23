import { contains, DENSITY_BUDGETS, indexOf, isFloor } from './model';
import type { Density, DecorationPreset, Layout, Point, Prop, Room } from './model';
import { Random, shuffleInPlace, streamSeed } from './random';
import { isTraversable, reservedTiles } from './validation';

const arrangement = [
  { x: 0, y: 0, kind: 'bookshelf', blocking: true },
  { x: 0, y: 2, kind: 'desk', blocking: true },
  { x: 1, y: 1, kind: 'scroll_case', blocking: false },
  { x: 0, y: 3, kind: 'rug', blocking: false },
] as const;

function rotate(point: Point, turn: number): Point {
  switch (turn) {
    case 1:
      return { x: -point.y, y: point.x };
    case 2:
      return { x: -point.x, y: -point.y };
    case 3:
      return { x: point.y, y: -point.x };
    default:
      return point;
  }
}

export function placeStudy(
  layout: Layout,
  props: readonly Prop[],
  seed: string,
  density: Density,
  preset: DecorationPreset,
  revision: number,
): readonly Prop[] | undefined {
  const random = new Random(streamSeed(seed, 'dungeon-study', 'v1', preset, density, revision));
  const reserved = reservedTiles(layout);
  const candidates: { room: Room; objects: readonly Prop[] }[] = [];
  for (const room of layout.rooms) {
    if (Math.floor(room.width * room.height * DENSITY_BUDGETS[density]) < 2) continue;
    for (let y = room.y; y < room.y + room.height; y++)
      for (let x = room.x; x < room.x + room.width; x++) {
        for (let turn = 0; turn < 4; turn++) {
          const outward = rotate({ x: 0, y: -1 }, turn);
          if (isFloor(layout, x + outward.x, y + outward.y)) continue;
          const objects = arrangement.map((object) => {
            const offset = rotate(object, turn);
            return { ...object, x: x + offset.x, y: y + offset.y, variation: turn / 4 };
          });
          if (objects.some((p) => !contains(room, p) || reserved.has(indexOf(p.x, p.y)))) continue;
          const rug = objects.find((p) => p.kind === 'rug');
          if (
            !rug ||
            rug.x <= room.x ||
            rug.x >= room.x + room.width - 1 ||
            rug.y <= room.y ||
            rug.y >= room.y + room.height - 1
          )
            continue;
          const retained = props.filter((p) => !contains(room, p));
          const blocked = new Set(
            [...retained, ...objects].filter((p) => p.blocking).map((p) => indexOf(p.x, p.y)),
          );
          if (isTraversable(layout, blocked)) candidates.push({ room, objects });
        }
      }
  }
  shuffleInPlace(candidates, random);
  const chosen = candidates[0];
  if (!chosen) return undefined;
  return [
    ...props.filter((p) => !contains(chosen.room, p)),
    ...chosen.objects.map((p) => ({ ...p, variation: p.variation + random.next() * 0.2 })),
  ];
}
