import { expect, test } from 'vitest';
import {
  courtyardEditorFixture,
  clearCourtyard,
  validCourtyardCommand,
  acceptCourtyard,
} from '../../../../scripts/courtyard-editor-test-support';
import { applyEditorCommand } from './editor-commands';
import { editorInstances } from './editor-view';
import { makeSavedMap, parseSavedMap } from '../../save/save-format';
import { propCells } from '../prop-footprint';

test('the Courtyard shrine blocks one square and rejects walls, collisions and malformed saves', () => {
  const base = courtyardEditorFixture(),
    map = clearCourtyard(base),
    before = structuredClone(map);
  expect(base.decoration.props.some((prop) => prop.kind === 'ruined_shrine')).toBe(false);
  const command = validCourtyardCommand(map, (target) => ({
    kind: 'add',
    propKind: 'ruined_shrine',
    target,
  }));
  const placed = acceptCourtyard(map, command);
  const shrine = editorInstances(placed).find((item) => item.id === 'added-1')?.prop;
  if (!shrine) throw Error('Missing shrine');
  expect(shrine.blocking).toBe(true);
  expect(propCells(shrine)).toEqual([{ x: shrine.x, y: shrine.y }]);
  expect(applyEditorCommand(placed, { kind: 'add', propKind: 'crate', target: shrine }).ok).toBe(
    false,
  );
  const wall = map.layout.tiles.findIndex((tile) => !tile);
  expect(wall).toBeGreaterThanOrEqual(0);
  expect(
    applyEditorCommand(placed, {
      kind: 'move',
      id: 'added-1',
      target: { x: wall % 40, y: Math.floor(wall / 40) },
    }).ok,
  ).toBe(false);
  const saved = makeSavedMap(
    placed,
    'Shrine',
    'data:image/png;base64,AAAA',
    'shrine',
    '2026-11-27T12:00:00Z',
  );
  expect(parseSavedMap(saved)?.map).toEqual(placed);
  for (const invalid of [
    { blocking: false },
    { artRotation: 4 },
    { footprint: { width: 2, height: 1 }, rotation: 0 },
  ]) {
    const bad = structuredClone(saved),
      prop = bad.map.objectEdits?.added[0]?.prop;
    if (!prop) throw Error('Missing saved shrine');
    Object.assign(prop, invalid);
    expect(parseSavedMap(bad)).toBeUndefined();
  }
  expect(map).toEqual(before);
});
