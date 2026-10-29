import '@angular/compiler';
import { describe, expect, test } from 'vitest';
import { pendingSettingChanges } from './pending-changes';
import {
  towerDraftForMap,
  courtyardDraftForMap,
  dungeonDraftForMap,
  forestDraftForMap,
} from './settings-draft';
import type { SettingsDraft } from './settings-draft';
import { WorkbenchSession } from './workbench-session';
import type { GeneratedMap } from '../engine/model';

function draftFor(map: GeneratedMap): SettingsDraft {
  if (map.type === 'tower') return towerDraftForMap(map);
  return map.type === 'dungeon'
    ? dungeonDraftForMap(map)
    : map.type === 'forest'
      ? forestDraftForMap(map)
      : courtyardDraftForMap(map);
}

describe.each(['dungeon', 'forest', 'courtyard'] as const)('%s pending changes', (type) => {
  test('describes only semantic edits without mutating the accepted map or raw draft', () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    const map = session.map();
    const original = structuredClone(map);
    const draft = Object.freeze({ ...draftFor(map), seed: `  ${map.seed}  ` });
    expect(pendingSettingChanges(map, draft)).toEqual([]);
    const edited = Object.freeze({ ...draft, seed: '  new-layout  ', density: 'Sparse' as const });
    expect(pendingSettingChanges(map, edited)).toEqual([
      { label: 'World seed', before: map.seed, after: 'new-layout' },
      { label: 'Decoration', before: 'Balanced', after: 'Sparse' },
    ]);
    expect(map).toEqual(original);
    expect(edited.seed).toBe('  new-layout  ');
  });

  test('the impact matches actual generation and reset/acceptance clears the changes', () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    const map = session.map();
    session.updateDraft({ type, changes: { density: 'Sparse' } });
    expect(session.generationEffect()).toBe('appearance');
    expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
    expect(session.map().layout).toBe(map.layout);
    expect(pendingSettingChanges(session.map(), session.draft())).toEqual([]);
    session.updateDraft({ type, changes: { seed: 'pending-summary-layout' } });
    expect(session.generationEffect()).toBe('layout');
    expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
    expect(session.map().layout).not.toBe(map.layout);
    session.updateDraft({ type, changes: { seed: '' } });
    expect(session.generationEffect()).toBe('invalid');
    expect(pendingSettingChanges(session.map(), session.draft())).toEqual([
      { label: 'World seed', before: 'pending-summary-layout', after: 'Not set' },
    ]);
    const accepted = session.map();
    expect(session.generate().ok).toBe(false);
    expect(session.map()).toBe(accepted);
    session.resetChanges();
    expect(session.pending()).toBe(false);
    expect(pendingSettingChanges(session.map(), session.draft())).toEqual([]);
  });
});

test('dungeon character and all additions use the displayed vocabulary', () => {
  const session = new WorkbenchSession();
  session.updateDraft({
    type: 'dungeon',
    changes: {
      preset: 'Crypt',
      scene: 'Forgotten study',
      landmark: 'weathered-statue',
      furniture: 'dining-table',
    },
  });
  expect(session.generationEffect()).toBe('appearance');
  expect(pendingSettingChanges(session.map(), session.draft())).toEqual([
    { label: 'Character', before: 'Mosslit stone', after: 'Ancient crypt' },
    {
      label: 'Additions',
      before: 'None',
      after: 'Forgotten study, Weathered statue, Dining table',
    },
  ]);
});

test('forest character and additions show exact names and removal back to None', () => {
  const session = new WorkbenchSession();
  session.selectMapType('forest');
  session.updateDraft({
    type: 'forest',
    changes: { character: 'Fey', scene: 'Abandoned camp', landmark: 'standing-stone-circle' },
  });
  const rows = pendingSettingChanges(session.map(), session.draft());
  expect(rows).toEqual([
    { label: 'Character', before: 'Verdant woodland', after: 'Fey glade' },
    { label: 'Additions', before: 'None', after: 'Abandoned camp, Standing-stone circle' },
  ]);
  expect(session.generate().ok).toBe(true);
  session.updateDraft({ type: 'forest', changes: { scene: 'None', landmark: 'None' } });
  expect(pendingSettingChanges(session.map(), session.draft())).toEqual([
    { label: 'Additions', before: 'Abandoned camp, Standing-stone circle', after: 'None' },
  ]);
});

test('courtyard fountain stays an appearance change and never invents a character edit', () => {
  const session = new WorkbenchSession();
  session.selectMapType('courtyard');
  session.updateDraft({ type: 'courtyard', changes: { fountain: true } });
  expect(session.generationEffect()).toBe('appearance');
  expect(pendingSettingChanges(session.map(), session.draft())).toEqual([
    { label: 'Additions', before: 'None', after: 'Dry fountain' },
  ]);
});

test.each(['6', '06', '0006'])(
  'valid room formatting %j does not invent a layout change',
  (rooms) => {
    const session = new WorkbenchSession();
    session.updateDraft({ type: 'dungeon', changes: { rooms } });
    expect(session.pending()).toBe(false);
    expect(pendingSettingChanges(session.map(), session.draft())).toEqual([]);
  },
);

test.each(['', '4.5', '6.0', ' 6 ', '3', '9'])(
  'invalid room draft %j prevents a generation promise',
  (rooms) => {
    const session = new WorkbenchSession();
    session.updateDraft({ type: 'dungeon', changes: { rooms, preset: 'Crypt' } });
    expect(session.generationEffect()).toBe('invalid');
    expect(pendingSettingChanges(session.map(), session.draft())[0]).toEqual({
      label: 'Rooms',
      before: '6',
      after: rooms === '' ? 'Not set' : rooms.trim() === rooms ? rooms : JSON.stringify(rooms),
    });
    session.updateDraft({ type: 'dungeon', changes: { rooms: '8' } });
    expect(session.generationEffect()).toBe('layout');
    session.updateDraft({ type: 'dungeon', changes: { rooms: '6' } });
    expect(session.generationEffect()).toBe('appearance');
  },
);

test('switching types, shuffling and opening a map recompute against accepted settings', () => {
  const session = new WorkbenchSession();
  const dungeon = session.map();
  session.updateDraft({ type: 'dungeon', changes: { preset: 'Crypt' } });
  expect(session.shuffle()).toBe(true);
  expect(session.generationEffect()).toBe('appearance');
  expect(pendingSettingChanges(session.map(), session.draft())).toHaveLength(1);
  session.selectMapType('forest');
  session.updateDraft({ type: 'forest', changes: { seed: 'separate-forest-draft' } });
  expect(session.generationEffect()).toBe('layout');
  session.selectMapType('dungeon');
  expect(session.generationEffect()).toBe('appearance');
  expect(pendingSettingChanges(session.map(), session.draft())[0]?.label).toBe('Character');
  session.openSaved(dungeon);
  expect(session.pending()).toBe(false);
  expect(pendingSettingChanges(session.map(), session.draft())).toEqual([]);
  session.selectMapType('forest');
  expect(session.generationEffect()).toBe('layout');
});

test('mismatched inputs do not produce a misleading cross-type comparison', () => {
  const session = new WorkbenchSession();
  const dungeon = session.map();
  session.selectMapType('forest');
  expect(pendingSettingChanges(dungeon, session.draft())).toEqual([]);
});
