import { describe, expect, test } from 'vitest';
import { generateDungeon } from '../engine/generate';
import { generateForestClearing, shuffleForestDetails } from '../engine/forest-generate';
import { shuffleDetails } from '../engine/decoration';
import type { ForestClearing, Prop, PropKind } from '../engine/model';
import { validateForest, validateForestLayout } from '../engine/forest-validation';
import { validateDungeon } from '../engine/validation';
import { makeSavedMap, parseBundle, parseSavedMap, serializeBundle } from './save-format';

const dungeonResult = generateDungeon({
  seed: 'mosslit-sanctum',
  roomCount: 6,
  density: 'Balanced',
  preset: 'Mosslit',
});
const forestResult = generateForestClearing({
  seed: 'mosslit-sanctum',
  density: 'Balanced',
  character: 'Verdant',
});
if (!dungeonResult.ok) throw new Error(dungeonResult.error);
if (!forestResult.ok) throw new Error(forestResult.error);
const dungeon = dungeonResult.map;
const forest = forestResult.map;
const dungeonBlocker = dungeon.decoration.props.find((prop) => prop.blocking);
const forestBlocker = forest.decoration.props.find((prop) => prop.blocking);
if (!dungeonBlocker || !forestBlocker) throw new Error('Expected blocking prop fixtures');

function record(map: unknown, id = 'candidate') {
  return {
    ...makeSavedMap(
      dungeon,
      'Acceptance fixture',
      'data:image/png;base64,AAAA',
      id,
      '2026-10-22T12:00:00.000Z',
    ),
    map,
  };
}

function expectRejected(map: unknown): void {
  expect(parseSavedMap(record(map))).toBeUndefined();
  const bundle = JSON.stringify({
    format: 'encounter-map-forge-saves',
    saveFormatVersion: '2.0.0',
    maps: [record(map), record(dungeon, 'valid')],
  });
  const parsed = parseBundle(bundle);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.error);
  expect(parsed.skipped).toBe(1);
  expect(parsed.maps.map((entry) => entry.id)).toEqual(['valid']);
}

function smallForest(floorCount = 200): ForestClearing {
  return {
    ...forest,
    layout: {
      tiles: Array.from({ length: 1200 }, (_, tile) => tile < floorCount),
      route: Array.from({ length: 40 }, (_, x) => 40 + x),
      pathStart: { x: 0, y: 1 },
      pathEnd: { x: 39, y: 1 },
    },
    decoration: { ...forest.decoration, props: [], density: 'Sparse' },
  };
}

const dungeonKinds: readonly (readonly [PropKind, boolean])[] = [
  ['crate', true],
  ['barrel', true],
  ['rubble', true],
  ['rug', false],
  ['sconce', false],
  ['moss', false],
  ['sarcophagus', true],
  ['vine', false],
  ['broken_column', true],
];
const forestKinds: readonly (readonly [PropKind, boolean])[] = [
  ['tree', false],
  ['boulder', true],
  ['fern', false],
  ['mushroom', false],
  ['bush', false],
  ['log', true],
  ['stump', true],
  ['flower', false],
];

describe('saved map acceptance at record and bundle boundaries', () => {
  test.each(dungeonKinds)('rejects a forest containing dungeon prop %s', (kind, blocking) => {
    expectRejected({
      ...forest,
      decoration: { ...forest.decoration, props: [{ ...forestBlocker, kind, blocking }] },
    });
  });
  test.each(forestKinds)('rejects a dungeon containing forest prop %s', (kind, blocking) => {
    expectRejected({
      ...dungeon,
      decoration: { ...dungeon.decoration, props: [{ ...dungeonBlocker, kind, blocking }] },
    });
  });
  test('rejects the two-tile forest from the quality review', () => {
    const tiles = Array<boolean>(1200).fill(false);
    tiles[41] = tiles[42] = true;
    expectRejected({
      ...forest,
      layout: { tiles, route: [41, 42], pathStart: { x: 1, y: 1 }, pathEnd: { x: 2, y: 1 } },
      decoration: { ...forest.decoration, props: [] },
    });
  });
  test('enforces the 200-tile minimum without rejecting a valid 200-tile forest', () => {
    expect(parseSavedMap(record(smallForest()))).toBeDefined();
    expect(validateForestLayout(smallForest().layout)).toBe(true);
    expect(validateForestLayout(smallForest(199).layout)).toBe(false);
    expect(validateForest(smallForest(199))).toBeDefined();
    expectRejected(smallForest(199));
  });
  test.each(['interior', 'same point', 'same edge'] as const)(
    'rejects %s forest endpoints',
    (kind) => {
      const map = smallForest();
      const layout =
        kind === 'interior'
          ? { ...map.layout, pathStart: { x: 4, y: 1 } }
          : kind === 'same point'
            ? { ...map.layout, pathEnd: map.layout.pathStart }
            : {
                ...map.layout,
                route: Array.from({ length: 40 }, (_, x) => x),
                pathStart: { x: 2, y: 0 },
                pathEnd: { x: 37, y: 0 },
              };
      expectRejected({ ...map, layout });
    },
  );
  test('rejects fractional path coordinates even when their linear index matches a valid tile', () => {
    const map = smallForest();
    expectRejected({ ...map, layout: { ...map.layout, pathEnd: { x: 38.5, y: 1.0125 } } });
  });
  test.each(['dungeon', 'forest'] as const)('rejects fractional %s prop coordinates', (type) => {
    const map = type === 'dungeon' ? dungeon : forest;
    const prop = type === 'dungeon' ? dungeonBlocker : forestBlocker;
    expectRejected({
      ...map,
      decoration: { ...map.decoration, props: [{ ...prop, x: prop.x + 0.5, y: prop.y - 0.0125 }] },
    });
  });
  test('rejects trees on walkable ground', () => {
    expectRejected({
      ...forest,
      decoration: {
        ...forest.decoration,
        props: [{ ...forestBlocker, kind: 'tree', blocking: false }],
      },
    });
  });
  test('rejects blocking route props even if the clearing still has another way around them', () => {
    const map = smallForest();
    expectRejected({
      ...map,
      decoration: {
        ...map.decoration,
        props: [{ x: 20, y: 1, kind: 'boulder', blocking: true, variation: 0.5 }],
      },
    });
  });
  test('rejects disconnected route additions and repeated route indices', () => {
    const map = smallForest();
    for (const tile of [199, 40])
      expectRejected({ ...map, layout: { ...map.layout, route: [...map.layout.route, tile] } });
  });
  test('enforces the forest blocking budget independently of connectivity', () => {
    const map = smallForest();
    const props: Prop[] = Array.from({ length: 11 }, (_, i) => ({
      x: i + 1,
      y: 3,
      kind: 'boulder',
      blocking: true,
      variation: 0.5,
    }));
    expect(
      parseSavedMap(
        record({ ...map, decoration: { ...map.decoration, props: props.slice(0, 10) } }),
      ),
    ).toBeDefined();
    expectRejected({ ...map, decoration: { ...map.decoration, props } });
  });
  test('enforces dungeon room budgets when density metadata changes', () => {
    expect(parseSavedMap(record(dungeon))).toBeDefined();
    expectRejected({ ...dungeon, decoration: { ...dungeon.decoration, density: 'Sparse' } });
  });
  test.each([dungeon, forest])(
    'rejects unsafe $type revisions and preserves supported extremes',
    (map) => {
      for (const revision of [Number.MAX_SAFE_INTEGER + 1, 1e100])
        expectRejected({ ...map, decoration: { ...map.decoration, revision } });
      for (const revision of [0, Number.MAX_SAFE_INTEGER]) {
        const accepted = { ...map, decoration: { ...map.decoration, revision } };
        const saved = parseSavedMap(record(accepted));
        expect(saved?.map).toBe(accepted);
        if (!saved) throw new Error('Expected supported revision');
        expect(parseBundle(serializeBundle([saved]))).toMatchObject({ ok: true, skipped: 0 });
      }
    },
  );
  test.each([dungeon, forest])('rejects noncanonical $type seed identities', (map) => {
    for (const seed of ['', ' ', ' padded', 'padded ', 'a'.repeat(65)])
      expectRejected({ ...map, seed });
    expect(parseSavedMap(record({ ...map, seed: 'a'.repeat(64) }))).toBeDefined();
  });
  test.each([dungeon, forest])('bounds $type props before semantic validation', (map) => {
    const prop = map.decoration.props.find((candidate) => !candidate.blocking);
    if (!prop) throw new Error('Expected a nonblocking prop');
    expect(
      parseSavedMap(
        record({
          ...map,
          decoration: { ...map.decoration, props: Array.from({ length: 2400 }, () => prop) },
        }),
      ),
    ).toBeDefined();
    expectRejected({
      ...map,
      decoration: { ...map.decoration, props: Array.from({ length: 2401 }, () => prop) },
    });
  });
  test('bounds dungeon rooms, connections and thresholds', () => {
    const layout = dungeon.layout;
    const room = layout.rooms[0];
    const connection = layout.connections[0];
    const threshold = layout.thresholds[0];
    if (!room || !connection || !threshold) throw new Error('Expected a complete dungeon fixture');
    for (const count of [0, 3, 9])
      expectRejected({
        ...dungeon,
        layout: { ...layout, rooms: Array.from({ length: count }, () => room) },
      });
    expect(
      parseSavedMap(
        record({
          ...dungeon,
          layout: {
            ...layout,
            connections: Array.from({ length: 8 }, () => connection),
            thresholds: Array.from({ length: 2400 }, () => threshold),
          },
        }),
      ),
    ).toBeDefined();
    expectRejected({
      ...dungeon,
      layout: { ...layout, connections: Array.from({ length: 9 }, () => connection) },
    });
    expectRejected({
      ...dungeon,
      layout: { ...layout, thresholds: Array.from({ length: 2401 }, () => threshold) },
    });
  });
  test('rejects a connected three-room dungeon outside the supported room range', () => {
    const rooms = dungeon.layout.rooms.filter(
      (room, position) =>
        position < 1 ||
        room.id === dungeon.layout.entrance.roomId ||
        room.id === dungeon.layout.objective.roomId,
    );
    const retained = new Set(rooms.map((room) => room.id));
    expect(rooms).toHaveLength(3);
    const candidate = {
      ...dungeon,
      layout: {
        ...dungeon.layout,
        rooms,
        thresholds: dungeon.layout.thresholds.filter((door) => retained.has(door.roomId)),
      },
      decoration: { ...dungeon.decoration, props: [] },
    };
    expect(validateDungeon(candidate)).toBeUndefined();
    expectRejected(candidate);
  });
  test('accepts generated settings and shuffled snapshots without changing their models', () => {
    for (let seed = 0; seed < 6; seed++) {
      for (const density of ['Sparse', 'Balanced', 'Cluttered'] as const) {
        for (const preset of ['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary'] as const) {
          const result = generateDungeon({
            seed: `acceptance-${seed}`,
            roomCount: 4 + (seed % 5),
            density,
            preset,
          });
          if (!result.ok) throw new Error(result.error);
          expect(parseSavedMap(record(result.map))?.map).toBe(result.map);
          const shuffled = shuffleDetails(result.map);
          expect(parseSavedMap(record(shuffled))?.map).toBe(shuffled);
        }
        for (const character of ['Verdant', 'Autumn', 'Pines', 'Fey'] as const) {
          const result = generateForestClearing({ seed: `acceptance-${seed}`, density, character });
          if (!result.ok) throw new Error(result.error);
          expect(parseSavedMap(record(result.map))?.map).toBe(result.map);
          const shuffled = shuffleForestDetails(result.map);
          expect(parseSavedMap(record(shuffled))?.map).toBe(shuffled);
        }
      }
    }
  });
});
