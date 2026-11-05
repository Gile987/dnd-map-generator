import '@angular/compiler';
import { expect, test } from 'vitest';
import {
  courtyardEditorFixture,
  validCourtyardCommand,
} from '../../../scripts/courtyard-editor-test-support';
import { WorkbenchSession } from './workbench-session';

test('Courtyard editing shares chronology, guards pins and stale sources, retains drafts/types, and recovers Generate replacement', () => {
  const base = courtyardEditorFixture(),
    session = new WorkbenchSession();
  session.openSaved(base);
  session.pinCurrent();
  session.updateDraft({ type: 'courtyard', changes: { seed: 'pending-courtyard-layout' } });
  const draft = session.draft(),
    command = validCourtyardCommand(base, (target) => ({ kind: 'add', propKind: 'fern', target }));
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
  session.selectMapType('courtyard');
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
  expect(session.draft().seed).toBe('pending-courtyard-layout');
});

test('rejected and no-op commands retain history and a reset is accepted and recoverable', () => {
  const base = courtyardEditorFixture(),
    session = new WorkbenchSession();
  session.openSaved(base);
  const initial = session.shuffleHistory();
  expect(session.editObjects(base, { kind: 'reset' }).ok).toBe(true);
  expect(session.map()).toBe(base);
  expect(session.shuffleHistory()).toEqual(initial);
  expect(
    session.editObjects(base, { kind: 'add', propKind: 'crate', target: { x: 1, y: 1 } }).ok,
  ).toBe(false);
  expect(session.map()).toBe(base);
  expect(session.shuffleHistory()).toEqual(initial);
  expect(
    session.editObjects(base, { kind: 'add', propKind: 'moss', target: { x: 1, y: 1 } }).ok,
  ).toBe(true);
  const edited = session.map();
  expect(session.editObjects(edited, { kind: 'reset' }).ok).toBe(true);
  expect(session.map()).toEqual(base);
  session.undoShuffle();
  expect(session.map()).toBe(edited);
});
