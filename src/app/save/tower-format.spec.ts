import { expect, test } from 'vitest';
import { generateTower, shuffleTowerDetails, TOWER_STAIR_STYLES } from '../engine/tower';
import {
  makeSavedMap,
  parseBundle,
  parseSavedMap,
  saveVocabulary,
  serializeBundle,
} from './save-format';
import { isUsableMap } from './map-schema';

test('format 14 round-trips both staircase styles and older vocabularies reject their metadata', () => {
  for (const stairStyle of TOWER_STAIR_STYLES)
    for (let count = 3; count <= 8; count++)
      for (const portalFloor of [null, 1, count - 1]) {
        const result = generateTower({
          seed: 'tower-save',
          stairStyle,
          floorCount: count,
          portalFloor,
          density: 'Balanced',
        });
        if (!result.ok) throw new Error(result.error);
        const map = shuffleTowerDetails(result.map),
          before = structuredClone(map);
        const saved = makeSavedMap(
          map,
          'Tower',
          'data:image/png;base64,AAAA',
          'tower',
          '2026-10-29T12:00:00Z',
        );
        expect(saved.saveFormatVersion).toBe('16.0.0');
        expect(isUsableMap(map)).toBe(true);
        expect(map.layout.stairStyle).toBe(stairStyle);
        expect(parseSavedMap({ ...saved, saveFormatVersion: '13.0.0' })).toBeUndefined();
        expect(parseSavedMap(saved)?.map).toBe(map);
        expect(parseBundle(serializeBundle([saved]))).toEqual({
          ok: true,
          maps: [saved],
          skipped: 0,
        });
        for (let v = 1; v <= 12; v++) {
          expect(saveVocabulary(`${v}.0.0`)?.mapTypes).not.toContain('tower');
          expect(parseSavedMap({ ...saved, saveFormatVersion: `${v}.0.0` })).toBeUndefined();
        }
        expect(
          parseSavedMap({ ...saved, map: { ...map, layout: { ...map.layout, connections: [] } } }),
        ).toBeUndefined();
        expect(map).toEqual(before);
      }
});

test('missing, unknown and historical staircase metadata is rejected without dropping the selection', () => {
  const result = generateTower({
    seed: 'styles',
    floorCount: 6,
    portalFloor: 2,
    density: 'Balanced',
    stairStyle: 'separate',
  });
  if (!result.ok) throw new Error(result.error);
  const map = result.map,
    saved = makeSavedMap(
      map,
      'Stairs',
      'data:image/png;base64,AAAA',
      'stairs',
      '2026-10-29T12:00:00Z',
    );
  for (const stairStyle of [undefined, null, 'Unknown', 0, {}, []]) {
    const candidate = { ...map, layout: { ...map.layout, stairStyle } };
    expect(isUsableMap(candidate)).toBe(false);
    expect(parseSavedMap({ ...saved, map: candidate })).toBeUndefined();
  }
  for (const version of ['1.0.0', '2.0.0']) expect(isUsableMap({ ...map, version })).toBe(false);
  expect(parseSavedMap(saved)?.map).toBe(map);
});
