import '@angular/compiler';
import { expect, test } from 'vitest';
import { layeredRugFixture } from '../../../scripts/layer-test-support';
import { WorkbenchSession } from './workbench-session';

test('layer order joins accepted history without changing drafts or pins, and rejects stale/pinned commands', () => {
  const { prepared, rug } = layeredRugFixture();
  const session = new WorkbenchSession();
  session.openSaved(prepared);
  session.pinCurrent();
  session.updateDraft({ type: 'dungeon', changes: { seed: 'pending-layer-map' } });
  const draft = session.draft();
  const command = { kind: 'order', id: rug.id, direction: 'forward' } as const;
  expect(session.editObjects(prepared, command).ok).toBe(true);
  const changed = session.map();
  expect(session.draft()).toBe(draft);
  expect(session.comparison().pinned).toBe(prepared);
  expect(session.editObjects(prepared, command).ok).toBe(false);
  session.selectCandidate('pinned');
  expect(session.editObjects(changed, command).ok).toBe(false);
  session.selectCandidate('current');
  session.undoShuffle();
  expect(session.map()).toBe(prepared);
  session.redoShuffle();
  expect(session.map()).toBe(changed);
  expect(session.draft()).toBe(draft);
});
