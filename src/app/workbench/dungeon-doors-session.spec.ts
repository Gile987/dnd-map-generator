import '@angular/compiler';
import { expect, test } from 'vitest';
import { dungeonDoors, doorIsOpen } from '../engine/dungeon-doors';
import { WorkbenchSession } from './workbench-session';

test('door history preserves drafts/pins and shuffles; appearance retains doors and a new layout clears them with undo recovery', () => {
  const session = new WorkbenchSession(),
    base = session.map();
  if (base.type !== 'dungeon') throw Error('Missing dungeon');
  const door = dungeonDoors(base.layout)[0];
  if (!door) throw Error('Missing door');
  session.pinCurrent();
  session.updateDraft({ type: 'dungeon', changes: { density: 'Cluttered' } });
  const draft = session.draft();
  expect(session.toggleDoor(base, door.id).ok).toBe(true);
  const opened = session.map();
  expect(session.draft()).toBe(draft);
  expect(session.comparison().pinned).toBe(base);
  expect(session.toggleDoor(base, door.id).ok).toBe(false);
  session.selectCandidate('pinned');
  expect(session.toggleDoor(opened, door.id).ok).toBe(false);
  session.selectCandidate('current');
  expect(session.shuffle()).toBe(true);
  const shuffled = session.map();
  expect(shuffled.type === 'dungeon' && shuffled.doorStates).toEqual({
    version: 1,
    open: [door.id],
  });
  session.undoShuffle();
  expect(session.map()).toBe(opened);
  session.undoShuffle();
  expect(session.map()).toBe(base);
  session.redoShuffle();
  expect(session.map()).toBe(opened);
  expect(session.generate().ok).toBe(true);
  const appearance = session.map();
  expect(appearance.type === 'dungeon' && doorIsOpen(appearance, door.id)).toBe(true);
  expect(appearance.layout).toBe(base.layout);
  session.selectMapType('forest');
  session.selectMapType('dungeon');
  expect(session.map()).toBe(appearance);
  session.updateDraft({ type: 'dungeon', changes: { seed: 'new-door-layout' } });
  expect(session.generate().ok).toBe(true);
  const changed = session.map();
  expect(changed.type === 'dungeon' && changed.doorStates).toBeUndefined();
  session.undoShuffle();
  expect(session.map()).toBe(appearance);
  session.openSaved(opened);
  expect(session.map()).toBe(opened);
  expect(session.pending()).toBe(false);
  expect(session.shuffleHistory()).toMatchObject({ undo: 0, redo: 0 });
});
