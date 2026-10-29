import '@angular/compiler';
import { expect, test } from 'vitest';
import { WorkbenchSession } from './workbench-session';
import { pendingSettingChanges } from './pending-changes';

test('tower drafts, pins, retained maps, density, shuffle history, rejection and recovery follow the workbench contract', () => {
  const session = new WorkbenchSession(),
    dungeon = session.map();
  session.selectMapType('tower');
  const initial = session.map();
  expect(initial.type).toBe('tower');
  expect(session.pending()).toBe(false);
  session.updateDraft({ type: 'tower', changes: { floors: '8', portalFloor: '3' } });
  expect(session.map()).toBe(initial);
  expect(session.generationEffect()).toBe('layout');
  expect(pendingSettingChanges(initial, session.draft()).map((c) => c.label)).toEqual([
    'Floors',
    'Secret portal',
  ]);
  session.selectMapType('dungeon');
  expect(session.map()).toBe(dungeon);
  session.selectMapType('tower');
  expect(session.pending()).toBe(true);
  expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
  const accepted = session.map();
  if (accepted.type !== 'tower') throw new Error('Expected tower');
  expect(accepted.layout.floors).toHaveLength(8);
  expect(accepted.layout.portalFloor).toBe(3);
  session.pinCurrent();
  session.updateDraft({ type: 'tower', changes: { density: 'Sparse' } });
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  expect(session.map().layout).toBe(accepted.layout);
  const sparse = session.map();
  session.updateDraft({ type: 'tower', changes: { seed: 'pending' } });
  const draft = session.draft();
  expect(session.shuffle()).toBe(true);
  const shuffled = session.map();
  expect(shuffled.layout).toBe(sparse.layout);
  session.undoShuffle();
  expect(session.map()).toBe(sparse);
  session.redoShuffle();
  expect(session.map()).toBe(shuffled);
  expect(session.draft()).toBe(draft);
  session.selectCandidate('pinned');
  expect(session.map()).toBe(accepted);
  session.updateDraft({ type: 'tower', changes: { floors: '2' } });
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(accepted);
  expect(session.currentMap()).toBe(shuffled);
  session.resetChanges();
  expect(session.pending()).toBe(false);
  session.openSaved(accepted);
  expect(session.map()).toBe(accepted);
  expect(session.shuffleHistory().undo).toBe(0);
  expect(session.draft()).toMatchObject({ floors: '8', portalFloor: '3' });
  session.updateDraft({ type: 'tower', changes: { portalFloor: 'none' } });
  expect(session.generate().ok).toBe(true);
  const regular = session.map();
  if (regular.type !== 'tower') throw new Error('Expected tower');
  expect(regular.layout.connections.every((c) => c.kind === 'stairs')).toBe(true);
});

test('staircase choices remain drafts, reset and retain independently, then generate and persist with their map', () => {
  const session = new WorkbenchSession();
  session.selectMapType('tower');
  const initial = session.map();
  session.updateDraft({ type: 'tower', changes: { stairStyle: 'separate' } });
  expect(session.map()).toBe(initial);
  expect(session.pending()).toBe(true);
  expect(session.generationEffect()).toBe('layout');
  expect(pendingSettingChanges(initial, session.draft())).toContainEqual({
    label: 'Staircase style',
    before: 'Shared spiral',
    after: 'Separate stairs',
  });
  session.selectMapType('forest');
  session.selectMapType('tower');
  expect(session.draft()).toMatchObject({ stairStyle: 'separate' });
  session.resetChanges();
  expect(session.draft()).toMatchObject({ stairStyle: 'spiral' });
  expect(session.pending()).toBe(false);
  session.updateDraft({ type: 'tower', changes: { stairStyle: 'separate' } });
  expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
  const separate = session.map();
  if (separate.type !== 'tower') throw new Error('Expected tower');
  expect(separate.layout.stairStyle).toBe('separate');
  session.updateDraft({ type: 'tower', changes: { stairStyle: 'spiral' } });
  expect(session.shuffle()).toBe(true);
  expect(session.currentMap().layout).toBe(separate.layout);
  session.undoShuffle();
  expect(session.map()).toBe(separate);
  expect(session.draft()).toMatchObject({ stairStyle: 'spiral' });
  session.openSaved(separate);
  expect(session.draft()).toMatchObject({ stairStyle: 'separate' });
  expect(session.pending()).toBe(false);
  session.updateDraft({ type: 'tower', changes: { stairStyle: 'invalid' as never } });
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(separate);
  session.resetChanges();
  expect(session.pending()).toBe(false);
});
