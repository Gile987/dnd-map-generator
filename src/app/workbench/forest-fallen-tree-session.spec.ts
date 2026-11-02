import '@angular/compiler';
import { expect, test, vi } from 'vitest';
import * as tree from '../engine/forest-fallen-tree';
import { WorkbenchSession } from './workbench-session';
import { pendingSettingChanges } from './pending-changes';

test('fallen-tree drafts retain maps, pins and history through refusal, retry, reset and undo', () => {
  const session = new WorkbenchSession();
  session.selectMapType('forest');
  session.pinCurrent();
  session.shuffle();
  const before = session.map();
  session.updateDraft({ type: 'forest', changes: { fallenTree: true, density: 'Sparse' } });
  expect(session.pending()).toBe(true);
  expect(session.generationEffect()).toBe('appearance');
  expect(pendingSettingChanges(before, session.draft())).toContainEqual({
    label: 'Additions',
    before: 'None',
    after: 'Fallen ancient tree',
  });
  session.selectMapType('courtyard');
  session.selectMapType('forest');
  const draft = session.draft(),
    pin = session.comparison(),
    history = session.shuffleHistory();
  const placement = vi.spyOn(tree, 'placeFallenTree').mockReturnValue(undefined);
  try {
    expect(session.generate()).toEqual({
      ok: false,
      error: 'That fallen ancient tree could not fit. Try another seed or remove an addition.',
    });
    expect(session.map()).toBe(before);
    expect(session.draft()).toBe(draft);
    expect(session.comparison()).toBe(pin);
    expect(session.shuffleHistory()).toEqual(history);
  } finally {
    placement.mockRestore();
  }
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  const accepted = session.map();
  expect(accepted.layout).toBe(before.layout);
  expect(accepted.surfaceSeed).toBe(before.surfaceSeed);
  expect(accepted.decoration).toMatchObject({
    fallenTree: true,
    density: 'Sparse',
    revision: before.decoration.revision,
  });
  session.updateDraft({ type: 'forest', changes: { fallenTree: false } });
  expect(session.shuffle()).toBe(true);
  session.undoShuffle();
  expect(session.map()).toBe(accepted);
  expect(session.draft()).toMatchObject({ fallenTree: false });
  session.resetChanges();
  expect(session.pending()).toBe(false);
  expect(session.draft()).toMatchObject({ fallenTree: true });
  session.openSaved(accepted);
  expect(session.draft()).toMatchObject({ fallenTree: true });
  session.updateDraft({ type: 'forest', changes: { fallenTree: false } });
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  expect(session.map().decoration).not.toHaveProperty('fallenTree');
});
