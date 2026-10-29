import { generateDungeon } from '../engine/generate';
import { generateForestClearing } from '../engine/forest-generate';
import { HEIGHT, WIDTH, contains } from '../engine/model';
import type { DecorationPreset, ForestCharacter, GeneratedMap, TileArea } from '../engine/model';

export type CharacterSample =
  | { readonly type: 'dungeon'; readonly id: DecorationPreset }
  | { readonly type: 'forest'; readonly id: ForestCharacter };

function frame(x: number, y: number, width: number, height: number): TileArea {
  const w = Math.max(width, height * 1.6);
  const h = w / 1.6;
  return {
    x: Math.max(0, Math.min(WIDTH - w, x - w / 2)),
    y: Math.max(0, Math.min(HEIGHT - h, y - h / 2)),
    width: w,
    height: h,
  };
}

/** A separate fixed example, never a workbench map or draft. */
export function characterSample(choice: CharacterSample): {
  readonly map: GeneratedMap;
  readonly region: TileArea;
} {
  if (choice.type === 'dungeon') {
    const result = generateDungeon({
      seed: 'character-showcase',
      roomCount: 6,
      density: 'Balanced',
      preset: choice.id,
    });
    if (!result.ok) throw new Error(result.error);
    const map = result.map;
    const preferred = {
      Mosslit: ['moss', 'sconce', 'rug'],
      Crypt: ['sarcophagus', 'sconce'],
      Storehouse: ['crate', 'barrel', 'rug'],
      Sanctuary: ['vine', 'broken_column', 'moss'],
    }[choice.id];
    const score = (room: (typeof map.layout.rooms)[number]) =>
      map.decoration.props
        .filter((prop) => contains(room, prop))
        .reduce((total, prop) => total + (preferred.includes(prop.kind) ? 3 : 1), 0);
    let room = map.layout.rooms[0];
    if (!room) throw new Error('Character sample needs a room.');
    for (const candidate of map.layout.rooms) if (score(candidate) > score(room)) room = candidate;
    return {
      map,
      region: frame(
        room.x + room.width / 2,
        room.y + room.height / 2,
        room.width + 1.3,
        room.height + 1.3,
      ),
    };
  }
  const result = generateForestClearing({
    seed: 'character-showcase',
    density: 'Balanced',
    character: choice.id,
  });
  if (!result.ok) throw new Error(result.error);
  const map = result.map,
    route = new Set(map.layout.route);
  const clearing = map.layout.tiles.flatMap((floor, tile) =>
    floor && !route.has(tile) ? [{ x: tile % WIDTH, y: Math.floor(tile / WIDTH) }] : [],
  );
  const left = Math.min(...clearing.map((p) => p.x)),
    right = Math.max(...clearing.map((p) => p.x));
  const top = Math.min(...clearing.map((p) => p.y));
  return { map, region: frame((left + right + 1) / 2, top + 2.6, 12.8, 8) };
}
