import '@angular/compiler';
import { expect, test } from 'vitest';
import { validCommand, rotationFixture } from '../../../scripts/editor-test-support';
import { WorkbenchSession } from './workbench-session';
import { generateDungeon } from '../engine/generate';
import { dungeonGroups } from '../engine/object-editor/dungeon-groups';

test('addition rotation shares accepted history while preserving drafts, pinned artwork and stale-command guards', () => {
  const { prepared, target } = rotationFixture('table');
  const session = new WorkbenchSession();
  session.openSaved(prepared);
  session.pinCurrent();
  session.updateDraft({ type: 'dungeon', changes: { seed: 'pending-rotation-layout' } });
  const draft = session.draft();
  expect(
    session.editObjects(prepared, { kind: 'move-group', id: 'table', target, rotation: 1 }).ok,
  ).toBe(true);
  const turned = session.map(),
    history = session.shuffleHistory();
  expect(session.draft()).toBe(draft);
  expect(session.comparison().pinned).toBe(prepared);
  expect(
    session.editObjects(prepared, { kind: 'move-group', id: 'table', target, rotation: 2 }).ok,
  ).toBe(false);
  expect(
    session.editObjects(turned, {
      kind: 'move-group',
      id: 'table',
      target: { x: 39, y: 29 },
      rotation: 2,
    }).ok,
  ).toBe(false);
  expect(session.map()).toBe(turned);
  expect(session.shuffleHistory()).toEqual(history);
  session.selectCandidate('pinned');
  expect(
    session.editObjects(turned, { kind: 'move-group', id: 'table', target, rotation: 2 }).ok,
  ).toBe(false);
  session.selectCandidate('current');
  session.undoShuffle();
  expect(session.map()).toBe(prepared);
  expect(session.draft()).toBe(draft);
  session.redoShuffle();
  expect(session.map()).toBe(turned);
  session.openSaved(turned);
  expect(session.pending()).toBe(false);
  expect(session.shuffleHistory()).toMatchObject({ undo: 0, redo: 0 });
});

test('complete-addition edits preserve pending settings, pins and exact chronological snapshots through refusal and recovery', () => {
  const generated = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: 'Mosslit',
    furniture: 'dining-table',
  });
  if (!generated.ok) throw Error(generated.error);
  const session = new WorkbenchSession(),
    base = generated.map;
  session.openSaved(base);
  session.pinCurrent();
  session.updateDraft({ type: 'dungeon', changes: { seed: 'pending-layout' } });
  const draft = session.draft(),
    group = dungeonGroups(base).find((g) => g.id === 'table');
  if (!group) throw Error('Missing table');
  const command = validCommand(
    base,
    (target) => ({ kind: 'move-group', id: 'table', target }),
    group.area,
  );
  expect(session.editObjects(base, command).ok).toBe(true);
  const moved = session.map(),
    history = session.shuffleHistory();
  expect(session.draft()).toBe(draft);
  expect(session.comparison().pinned).toBe(base);
  expect(
    session.editObjects(moved, { kind: 'move-group', id: 'table', target: { x: 0, y: 0 } }).ok,
  ).toBe(false);
  expect(session.map()).toBe(moved);
  expect(session.shuffleHistory()).toEqual(history);
  expect(session.editObjects(base, command).ok).toBe(false);
  session.undoShuffle();
  expect(session.map()).toBe(base);
  expect(session.draft()).toBe(draft);
  session.redoShuffle();
  expect(session.map()).toBe(moved);
  session.selectMapType('forest');
  session.selectMapType('dungeon');
  expect(session.map()).toBe(moved);
  session.openSaved(moved);
  expect(session.map()).toBe(moved);
  expect(session.pending()).toBe(false);
  expect(session.shuffleHistory()).toMatchObject({ undo: 0, redo: 0 });
});

test('editing shares bounded chronological history with shuffles and preserves drafts, pins, map types and accepted references on refusal', () => {
  const session = new WorkbenchSession();
  expect(session.shuffle()).toBe(true);
  const base = session.map();
  if (base.type !== 'dungeon') throw new Error('Missing dungeon');
  session.pinCurrent();
  session.updateDraft({ type: 'dungeon', changes: { seed: 'pending-layout' } });
  const draft = session.draft(),
    history = session.shuffleHistory();
  expect(
    session.editObjects(base, { kind: 'add', propKind: 'moss', target: { x: 0, y: 0 } }).ok,
  ).toBe(false);
  expect(session.map()).toBe(base);
  expect(session.draft()).toBe(draft);
  expect(session.shuffleHistory()).toEqual(history);
  const command = validCommand(base, (target) => ({ kind: 'add', propKind: 'moss', target }));
  expect(session.editObjects(base, command).ok).toBe(true);
  const edited = session.map();
  expect(edited.type === 'dungeon' && edited.objectEdits).toBeTruthy();
  expect(session.draft()).toBe(draft);
  expect(session.comparison().pinned).toBe(base);
  expect(session.shuffle()).toBe(false);
  expect(session.editObjects(base, command).ok).toBe(false); // Stale drag.
  session.selectMapType('forest');
  session.selectMapType('dungeon');
  expect(session.map()).toBe(edited);
  session.selectCandidate('pinned');
  expect(session.map()).toBe(base);
  expect(session.editObjects(edited, { kind: 'reset' }).ok).toBe(false);
  session.selectCandidate('current');
  session.undoShuffle();
  expect(session.map()).toBe(base);
  expect(session.draft()).toBe(draft);
  session.redoShuffle();
  expect(session.map()).toBe(edited);
  expect(session.editObjects(edited, { kind: 'reset' }).ok).toBe(true);
  expect(session.map()).toEqual(base);
  session.undoShuffle();
  expect(session.map()).toBe(edited);
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(edited);
  expect(session.generate(true)).toEqual({ ok: true, layoutChanged: true });
  const generated = session.map();
  expect(generated.seed).toBe('pending-layout');
  session.undoShuffle();
  expect(session.map()).toBe(edited);
  session.redoShuffle();
  expect(session.map()).toBe(generated);
  session.openSaved(edited);
  expect(session.map()).toBe(edited);
  expect(session.pending()).toBe(false);
  expect(session.shuffleHistory()).toMatchObject({ undo: 0, redo: 0 });
});

test('new successful edits clear redo, failed/no-op edits retain it and unchanged submissions do not replace customized maps', () => {
  const session = new WorkbenchSession(),
    base = session.map();
  if (base.type !== 'dungeon') throw new Error('Missing dungeon');
  const command = validCommand(base, (target) => ({ kind: 'add', propKind: 'moss', target }));
  session.editObjects(base, command);
  const edited = session.map();
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  expect(session.map()).toBe(edited);
  session.undoShuffle();
  const history = session.shuffleHistory();
  session.editObjects(base, { kind: 'reset' });
  expect(session.shuffleHistory()).toEqual(history);
  session.editObjects(base, { kind: 'add', propKind: 'moss', target: { x: 0, y: 0 } });
  expect(session.shuffleHistory()).toEqual(history);
  session.editObjects(base, command);
  expect(session.shuffleHistory().redo).toBe(0);
});
