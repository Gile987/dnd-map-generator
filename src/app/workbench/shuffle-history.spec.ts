import '@angular/compiler';
import { afterEach, expect, test, vi } from 'vitest';
import * as dungeonEngine from '../engine/generate';
import * as dungeonDecoration from '../engine/decoration';
import * as forestEngine from '../engine/forest-generate';
import { WorkbenchSession } from './workbench-session';

afterEach(() => vi.restoreAllMocks());

for (const type of ['dungeon', 'forest'] as const) {
  test(`${type} undo and redo restore exact snapshots without invoking the engine`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    const original = session.map();
    const frozen = structuredClone(original);
    expect(session.shuffleHistory()).toEqual({ undo: 0, redo: 0, limit: 20 });
    session.undoShuffle();
    session.redoShuffle();
    expect(session.map()).toBe(original);
    expect(session.shuffle()).toBe(true);
    const first = session.map();
    session.shuffle();
    const second = session.map();
    session.updateDraft(
      type === 'dungeon'
        ? { type, changes: { seed: '', rooms: '4.5', furniture: 'dining-table' } }
        : { type, changes: { seed: '', character: 'Fey', scene: 'Abandoned camp' } },
    );
    const draft = session.draft();
    const spies = [
      vi.spyOn(dungeonEngine, 'generateDungeon'),
      vi.spyOn(forestEngine, 'generateForestClearing'),
      vi.spyOn(dungeonDecoration, 'shuffleDetails'),
      vi.spyOn(forestEngine, 'shuffleForestDetails'),
    ];
    session.undoShuffle();
    expect(session.map()).toBe(first);
    expect(session.shuffleHistory()).toEqual({ undo: 1, redo: 1, limit: 20 });
    session.undoShuffle();
    expect(session.map()).toBe(original);
    expect(session.shuffleHistory()).toEqual({ undo: 0, redo: 2, limit: 20 });
    session.undoShuffle();
    expect(session.map()).toBe(original);
    session.redoShuffle();
    expect(session.map()).toBe(first);
    session.redoShuffle();
    expect(session.map()).toBe(second);
    session.redoShuffle();
    expect(session.map()).toBe(second);
    expect(session.shuffleHistory()).toEqual({ undo: 2, redo: 0, limit: 20 });
    expect(session.draft()).toBe(draft);
    expect(session.pending()).toBe(true);
    expect(original).toEqual(frozen);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  test(`${type} fresh shuffles discard redo while draft edits and resets retain it`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    session.shuffle();
    session.shuffle();
    session.undoShuffle();
    const current = session.map();
    session.updateDraft({ type, changes: { seed: 'unapplied' } });
    session.resetChanges();
    expect(session.map()).toBe(current);
    expect(session.shuffleHistory()).toEqual({ undo: 1, redo: 1, limit: 20 });
    expect(session.generate().ok).toBe(true);
    expect(session.shuffleHistory().redo).toBe(1);
    expect(session.shuffle()).toBe(true);
    expect(session.shuffleHistory()).toEqual({ undo: 2, redo: 0, limit: 20 });
    const branched = session.map();
    session.redoShuffle();
    expect(session.map()).toBe(branched);
    session.undoShuffle();
    expect(session.map()).toBe(current);
  });

  test(`${type} history retains only the 20 most recent shuffles`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    const snapshots = [session.map()];
    for (let i = 0; i < 23; i++) {
      expect(session.shuffle()).toBe(true);
      snapshots.push(session.map());
    }
    expect(session.shuffleHistory()).toEqual({ undo: 20, redo: 0, limit: 20 });
    for (let index = 22; index >= 3; index--) {
      session.undoShuffle();
      expect(session.map()).toBe(snapshots[index]);
    }
    expect(session.shuffleHistory()).toEqual({ undo: 0, redo: 20, limit: 20 });
    session.undoShuffle();
    expect(session.map()).toBe(snapshots[3]);
    for (let index = 4; index <= 23; index++) {
      session.redoShuffle();
      expect(session.map()).toBe(snapshots[index]);
    }
    expect(session.shuffleHistory()).toEqual({ undo: 20, redo: 0, limit: 20 });
  });

  for (const action of ['appearance', 'layout', 'open'] as const) {
    test(`${type} ${action} starts a new history only for the affected map type`, () => {
      const session = new WorkbenchSession();
      const other = type === 'dungeon' ? 'forest' : 'dungeon';
      session.selectMapType(other);
      session.shuffle();
      const otherMap = session.map();
      session.selectMapType(type);
      const original = session.map();
      session.shuffle();
      session.shuffle();
      session.undoShuffle();
      if (action === 'open') session.openSaved(original);
      else {
        session.updateDraft(
          action === 'layout'
            ? { type, changes: { seed: 'new-history' } }
            : type === 'dungeon'
              ? { type, changes: { preset: 'Crypt' } }
              : { type, changes: { character: 'Autumn' } },
        );
        expect(session.generate().ok).toBe(true);
      }
      const accepted = session.map();
      expect(session.shuffleHistory()).toEqual({ undo: 0, redo: 0, limit: 20 });
      session.undoShuffle();
      session.redoShuffle();
      expect(session.map()).toBe(accepted);
      session.selectMapType(other);
      expect(session.map()).toBe(otherMap);
      expect(session.shuffleHistory().undo).toBe(1);
      session.undoShuffle();
      expect(session.map().decoration.revision).toBe(0);
    });
  }

  test(`${type} rejected actions preserve both history directions and allow recovery`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    session.shuffle();
    const first = session.map();
    session.shuffle();
    const second = session.map();
    session.undoShuffle();
    const history = session.shuffleHistory();
    session.updateDraft({ type, changes: { seed: '' } });
    expect(session.generate().ok).toBe(false);
    expect(session.map()).toBe(first);
    expect(session.shuffleHistory()).toEqual(history);
    session.resetChanges();
    session.updateDraft(
      type === 'dungeon'
        ? { type, changes: { preset: 'Crypt' } }
        : { type, changes: { character: 'Autumn' } },
    );
    if (type === 'dungeon')
      vi.spyOn(dungeonDecoration, 'changePreset').mockImplementationOnce((map) => map);
    else vi.spyOn(forestEngine, 'changeForestCharacter').mockImplementationOnce((map) => map);
    const draft = session.draft();
    expect(session.generate().ok).toBe(false);
    const throwOnShuffle = () => {
      throw new Error('Shuffle failed');
    };
    if (type === 'dungeon')
      vi.spyOn(dungeonDecoration, 'shuffleDetails')
        .mockImplementationOnce((map) => map)
        .mockImplementationOnce(throwOnShuffle);
    else
      vi.spyOn(forestEngine, 'shuffleForestDetails')
        .mockImplementationOnce((map) => map)
        .mockImplementationOnce(throwOnShuffle);
    expect(session.shuffle()).toBe(false);
    expect(() => session.shuffle()).toThrow('Shuffle failed');
    expect(session.map()).toBe(first);
    expect(session.shuffleHistory()).toEqual(history);
    expect(session.draft()).toBe(draft);
    session.redoShuffle();
    expect(session.map()).toBe(second);
    session.undoShuffle();
    expect(session.map()).toBe(first);
    expect(session.generate().ok).toBe(true);
    expect(session.shuffleHistory()).toEqual({ undo: 0, redo: 0, limit: 20 });
    expect(session.shuffle()).toBe(true);
    expect(session.shuffleHistory().undo).toBe(1);
  });

  test(`${type} generation failures preserve an undone position until a successful retry`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    session.shuffle();
    const first = session.map();
    session.shuffle();
    const second = session.map();
    session.undoShuffle();
    session.updateDraft({ type, changes: { seed: 'history-retry' } });
    const draft = session.draft();
    const history = session.shuffleHistory();
    const throwOnGenerate = () => {
      throw new Error('Generation failed');
    };
    if (type === 'dungeon')
      vi.spyOn(dungeonEngine, 'generateDungeon')
        .mockReturnValueOnce({ ok: false, error: 'No layout' })
        .mockImplementationOnce(throwOnGenerate);
    else
      vi.spyOn(forestEngine, 'generateForestClearing')
        .mockReturnValueOnce({ ok: false, error: 'No layout' })
        .mockImplementationOnce(throwOnGenerate);
    expect(session.generate()).toEqual({ ok: false, error: 'No layout' });
    expect(() => session.generate()).toThrow('Generation failed');
    expect(session.map()).toBe(first);
    expect(session.draft()).toBe(draft);
    expect(session.shuffleHistory()).toEqual(history);
    session.redoShuffle();
    expect(session.map()).toBe(second);
    expect(session.generate().ok).toBe(true);
    expect(session.map().seed).toBe('history-retry');
    expect(session.shuffleHistory()).toEqual({ undo: 0, redo: 0, limit: 20 });
  });

  test(`${type} the revision limit leaves a successful shuffle available to undo`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    const original = session.map();
    const almostExhausted = {
      ...original,
      decoration: { ...original.decoration, revision: Number.MAX_SAFE_INTEGER - 1 },
    };
    // Keep the discriminator correlated with its layout and decoration.
    session.openSaved(
      original.type === 'dungeon'
        ? {
            ...original,
            decoration: { ...original.decoration, revision: almostExhausted.decoration.revision },
          }
        : {
            ...original,
            decoration: { ...original.decoration, revision: almostExhausted.decoration.revision },
          },
    );
    const before = session.map();
    expect(session.shuffle()).toBe(true);
    const exhausted = session.map();
    expect(exhausted.decoration.revision).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => session.shuffle()).toThrow('detail revision limit');
    expect(session.map()).toBe(exhausted);
    expect(session.shuffleHistory()).toEqual({ undo: 1, redo: 0, limit: 20 });
    session.undoShuffle();
    expect(session.map()).toBe(before);
    session.redoShuffle();
    expect(session.map()).toBe(exhausted);
  });
}

test('switching map types and opening another type retain independent shuffle positions', () => {
  const session = new WorkbenchSession();
  session.shuffle();
  const dungeon = session.map();
  session.undoShuffle();
  session.selectMapType('forest');
  const forest = session.map();
  expect(session.shuffleHistory().redo).toBe(0);
  session.shuffle();
  session.updateDraft({ type: 'forest', changes: { seed: 'forest-draft' } });
  const draft = session.draft();
  session.selectMapType('dungeon');
  expect(session.shuffleHistory()).toEqual({ undo: 0, redo: 1, limit: 20 });
  session.redoShuffle();
  expect(session.map()).toBe(dungeon);
  session.openSaved(forest);
  expect(session.map()).toBe(forest);
  expect(session.shuffleHistory().undo).toBe(0);
  expect(session.draft()).not.toBe(draft);
  session.selectMapType('dungeon');
  expect(session.map()).toBe(dungeon);
  expect(session.shuffleHistory().undo).toBe(1);
  const fresh = new WorkbenchSession();
  expect(fresh.shuffleHistory()).toEqual({ undo: 0, redo: 0, limit: 20 });
});
