import '@angular/compiler';
import { expect, test } from 'vitest';
import {
  towerStairFixture,
  towerEditorFixture,
  validTowerCommand,
} from '../../../scripts/tower-editor-test-support';
import { WorkbenchSession } from './workbench-session';

test('Tower editing shares chronology, guards pins and stale sources, retains drafts/types, and recovers Generate replacement', () => {
  const base = towerEditorFixture(),
    session = new WorkbenchSession();
  session.openSaved(base);
  session.pinCurrent();
  session.updateDraft({ type: 'tower', changes: { seed: 'pending-tower-layout' } });
  const draft = session.draft(),
    command = validTowerCommand(base, 1, (target) => ({ kind: 'add', propKind: 'moss', target }));
  expect(session.editObjects(base, command).ok).toBe(true);
  const edited = session.map();
  expect(session.draft()).toBe(draft);
  expect(session.comparison().pinned).toBe(base);
  expect(session.editObjects(base, command).ok).toBe(false);
  session.selectCandidate('pinned');
  expect(session.editObjects(edited, command).ok).toBe(false);
  session.selectCandidate('current');
  expect(session.shuffle()).toBe(false);
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(edited);
  session.selectMapType('forest');
  session.selectMapType('tower');
  expect(session.map()).toBe(edited);
  expect(session.draft()).toBe(draft);
  expect(session.generate(true).ok).toBe(true);
  expect(session.map()).not.toHaveProperty('objectEdits');
  session.undoShuffle();
  expect(session.map()).toBe(edited);
  session.undoShuffle();
  expect(session.map()).toBe(base);
  session.redoShuffle();
  expect(session.map()).toBe(edited);
  expect(session.draft().seed).toBe('pending-tower-layout');
});

test('rejected and no-op commands retain history and a reset is accepted and recoverable', () => {
  const base = towerEditorFixture(),
    session = new WorkbenchSession();
  session.openSaved(base);
  const initial = session.shuffleHistory();
  expect(session.editObjects(base, { kind: 'reset' }).ok).toBe(true);
  expect(session.map()).toBe(base);
  expect(session.shuffleHistory()).toEqual(initial);
  expect(
    session.editObjects(base, { kind: 'add', propKind: 'tree', target: { x: 1, y: 1 } }).ok,
  ).toBe(false);
  expect(session.map()).toBe(base);
  expect(session.shuffleHistory()).toEqual(initial);
  expect(
    session.editObjects(
      base,
      validTowerCommand(base, 1, (target) => ({ kind: 'add', propKind: 'moss', target })),
    ).ok,
  ).toBe(true);
  const edited = session.map();
  expect(session.editObjects(edited, { kind: 'reset' }).ok).toBe(true);
  expect(session.map()).toEqual(base);
  session.undoShuffle();
  expect(session.map()).toBe(edited);
});

test('staircase edits retain drafts, immutable snapshots and history through refusal, undo, redo, reset and Generate', () => {
  const { prepared, command } = towerStairFixture(),
    session = new WorkbenchSession();
  session.openSaved(prepared);
  session.updateDraft({ type: 'tower', changes: { seed: 'pending-stairs' } });
  const draft = session.draft();
  expect(session.editObjects(prepared, command).ok).toBe(true);
  const moved = session.map(),
    history = session.shuffleHistory();
  expect(session.draft()).toBe(draft);
  expect(session.editObjects(moved, { ...command, target: { x: 0, y: 0 } }).ok).toBe(false);
  expect(session.map()).toBe(moved);
  expect(session.shuffleHistory()).toEqual(history);
  session.undoShuffle();
  expect(session.map()).toBe(prepared);
  session.redoShuffle();
  expect(session.map()).toBe(moved);
  expect(session.shuffle()).toBe(false);
  expect(session.editObjects(moved, { kind: 'reset' }).ok).toBe(true);
  session.undoShuffle();
  expect(session.map()).toBe(moved);
  expect(session.generate().ok).toBe(false);
  expect(session.generate(true).ok).toBe(true);
  expect(session.map()).not.toHaveProperty('objectEdits');
  session.undoShuffle();
  expect(session.map()).toBe(moved);
  expect(session.draft()).toEqual(draft);
});
