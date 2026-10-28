import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from 'vitest';
import fixture from '../save/fixtures/study-v9.json';
import { parseBundle } from '../save/save-format';
import { ALL_DENSITIES, ALL_PRESETS, contains, indexOf } from '../engine/model';
import type { Dungeon } from '../engine/model';
import { generateDungeon } from '../engine/generate';
import { shuffleDetails } from '../engine/decoration';
import { propCells } from '../engine/prop-footprint';
import { reservedTiles } from '../engine/dungeon-space';
import { renderMap } from './render-map';
import { studySurfaceMarks } from './study-surface';

function legacyStudy(): Dungeon {
  const parsed = parseBundle(JSON.stringify(fixture));
  if (!parsed.ok || parsed.maps[0]?.map.type !== 'dungeon') throw new Error('Invalid fixture');
  return parsed.maps[0].map;
}

function pixels(map: Dungeon, grid: boolean, scale = 64) {
  const canvas = createCanvas(40 * scale, 30 * scale);
  const ctx = canvas.getContext('2d');
  renderMap(ctx, map, { grid, pixelsPerTile: scale });
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

test.each([
  [false, '34c85f287f183ad4e7d876a7142d0cda63eb45cc7e5883569cbcb3585706f9ed'],
  [true, 'fcb1eb06d6903a1a69415ebe41718654f781704397f5d11a516b7e048a7b8d71'],
] as const)('preserves captured format-9 study artwork, grid=%s', (grid, hash) => {
  const map = legacyStudy();
  expect(map.decoration).not.toHaveProperty('studySurface');
  expect(studySurfaceMarks(map)).toEqual([]);
  expect(createHash('sha256').update(pixels(map, grid)).digest('hex')).toBe(hash);
});

test('new study artwork preserves the independently captured model and generator draws', () => {
  const old = legacyStudy();
  const result = generateDungeon({
    seed: old.seed,
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    scene: 'Forgotten study',
  });
  if (!result.ok) throw new Error(result.error);
  const { studySurface, ...decoration } = result.map.decoration;
  expect(studySurface).toBe(1);
  expect({ ...result.map, decoration }).toEqual(old);
  const before = structuredClone(old);
  const shuffled = shuffleDetails(old);
  expect(shuffled.decoration.studySurface).toBe(1);
  expect(shuffled.layout).toBe(old.layout);
  expect(old).toEqual(before);
});

test.each(ALL_PRESETS)(
  '%s marks stay within clear study floor across densities and rotations',
  (preset) => {
    const turns = new Set<number>();
    for (const density of ALL_DENSITIES) {
      for (let seed = 0; seed < 6; seed++) {
        const result = generateDungeon({
          seed: `study-${seed}`,
          roomCount: 6,
          density,
          preset,
          scene: 'Forgotten study',
        });
        if (!result.ok) throw new Error(result.error);
        for (const map of [result.map, shuffleDetails(result.map)]) {
          const snapshot = structuredClone(map);
          const desk = map.decoration.props.find((prop) => prop.kind === 'desk');
          const shelf = map.decoration.props.find((prop) => prop.kind === 'bookshelf');
          const room = desk && map.layout.rooms.find((candidate) => contains(candidate, desk));
          if (!room || !desk || !shelf) throw new Error('Missing study');
          turns.add(Math.floor(desk.variation * 4));
          const marks = studySurfaceMarks(map);
          expect(marks).toEqual(studySurfaceMarks(map));
          expect(marks.some((mark) => mark.kind === 'paper')).toBe(true);
          const occupied = new Set(
            map.decoration.props.flatMap(propCells).map((p) => indexOf(p.x, p.y)),
          );
          const reserved = reservedTiles(map.layout);
          for (const mark of marks) {
            const radius = mark.kind === 'wear' ? 0.3 : 0.22;
            expect(mark.x - radius).toBeGreaterThanOrEqual(Math.floor(mark.x));
            expect(mark.x + radius).toBeLessThan(Math.floor(mark.x) + 1);
            expect(mark.y - radius).toBeGreaterThanOrEqual(Math.floor(mark.y));
            expect(mark.y + radius).toBeLessThan(Math.floor(mark.y) + 1);
            expect(contains(room, mark)).toBe(true);
            const tile = indexOf(Math.floor(mark.x), Math.floor(mark.y));
            expect(occupied.has(tile)).toBe(false);
            expect(
              map.decoration.props.some(
                (prop) =>
                  prop.kind === 'rug' &&
                  Math.abs(Math.floor(mark.x) - prop.x) <= 1 &&
                  Math.abs(Math.floor(mark.y) - prop.y) <= 1,
              ),
            ).toBe(false);
            if (mark.kind !== 'wear') {
              expect(reserved.has(tile)).toBe(false);
              expect(
                Math.min(
                  Math.hypot(Math.floor(mark.x) - desk.x, Math.floor(mark.y) - desk.y),
                  Math.hypot(Math.floor(mark.x) - shelf.x, Math.floor(mark.y) - shelf.y),
                ),
              ).toBeLessThanOrEqual(2);
            }
          }
          expect(map).toEqual(snapshot);
        }
      }
    }
    expect([...turns].sort()).toEqual([0, 1, 2, 3]);
  },
);

test.each([64, 70, 100])(
  'only study objects and marked floor tiles change at %s pixels per tile',
  (scale) => {
    const old = legacyStudy();
    const map: Dungeon = { ...old, decoration: { ...old.decoration, studySurface: 1 } };
    const marks = studySurfaceMarks(map);
    expect(new Set(marks.map((mark) => mark.kind))).toEqual(new Set(['wear', 'paper', 'ink']));
    const tiles = new Set(marks.map((mark) => indexOf(Math.floor(mark.x), Math.floor(mark.y))));
    for (const prop of map.decoration.props) {
      if (['desk', 'bookshelf', 'scroll_case'].includes(prop.kind))
        tiles.add(indexOf(prop.x, prop.y));
    }
    const before = pixels(old, true, scale);
    const after = pixels(map, true, scale);
    let differences = 0;
    let outside = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (
        before[i] === after[i] &&
        before[i + 1] === after[i + 1] &&
        before[i + 2] === after[i + 2] &&
        before[i + 3] === after[i + 3]
      )
        continue;
      differences++;
      const p = i / 4;
      if (
        !tiles.has(
          indexOf(Math.floor((p % (40 * scale)) / scale), Math.floor(p / (40 * scale * scale))),
        )
      )
        outside++;
    }
    expect(differences).toBeGreaterThan(100);
    expect(outside).toBe(0);
  },
);
