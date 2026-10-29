import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import fixture from '../src/app/save/fixtures/forest-v4-surfaces.json';
import { parseBundle } from '../src/app/save/save-format';
import { ALL_FOREST_CHARACTERS } from '../src/app/engine/model';
import { forestSurfacePatches } from '../src/app/rendering/forest-surface';
import { renderForest } from '../src/app/rendering/forest-renderer';

test.each(ALL_FOREST_CHARACTERS)(
  'reviews %s forest floor details against the original artwork',
  (character) => {
    const parsed = parseBundle(JSON.stringify(fixture));
    if (!parsed.ok) throw new Error(parsed.error);
    const old = parsed.maps.find(
      (record) => record.map.type === 'forest' && record.map.decoration.character === character,
    )?.map;
    if (!old || old.type !== 'forest') throw new Error('Missing historical forest');
    const map = { ...old, decoration: { ...old.decoration, forestSurface: 1 as const } };
    const patches = forestSurfacePatches(map);
    const first = patches.find((p) => p.kind !== 'ash');
    const hearth = map.decoration.props.find((p) => p.kind === 'fire_ring');
    if (!first || !hearth) throw new Error('Missing details');
    expect(patches.length).toBeGreaterThan(5);
    mkdirSync('artifacts/forest-surface', { recursive: true });
    for (const scale of [64, 100]) {
      const before = createCanvas(40 * scale, 30 * scale),
        after = createCanvas(40 * scale, 30 * scale);
      renderForest(before.getContext('2d'), old, { grid: true, pixelsPerTile: scale });
      renderForest(after.getContext('2d'), map, { grid: true, pixelsPerTile: scale });
      writeFileSync(
        `artifacts/forest-surface/${character}-${scale}.png`,
        after.toBuffer('image/png'),
      );
      for (const [name, point] of [
        ['drift', first],
        ['camp', hearth],
      ] as const) {
        const x = Math.max(0, Math.min(35, Math.floor(point.x) - 2)),
          y = Math.max(0, Math.min(25, Math.floor(point.y) - 2));
        const detail = createCanvas(10 * scale, 5 * scale),
          ctx = detail.getContext('2d');
        ctx.drawImage(
          before,
          x * scale,
          y * scale,
          5 * scale,
          5 * scale,
          0,
          0,
          5 * scale,
          5 * scale,
        );
        ctx.drawImage(
          after,
          x * scale,
          y * scale,
          5 * scale,
          5 * scale,
          5 * scale,
          0,
          5 * scale,
          5 * scale,
        );
        writeFileSync(
          `artifacts/forest-surface/${character}-${scale}-${name}.png`,
          detail.toBuffer('image/png'),
        );
      }
    }
  },
);
