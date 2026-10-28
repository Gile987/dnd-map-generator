import '@angular/compiler';
import { afterEach, expect, test, vi } from 'vitest';
import { WorkbenchSession } from './workbench-session';
import * as dungeon from '../engine/decoration';
import * as forest from '../engine/forest-generate';
import * as courtyard from '../engine/courtyard-generate';
import * as generation from '../engine/generate';

afterEach(() => vi.restoreAllMocks());

for (const type of ['dungeon', 'forest', 'courtyard'] as const) {
  test(`${type} pin and switching retain exact snapshots, drafts and history without engine calls`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    const pinned = session.map();
    const snapshot = structuredClone(pinned);
    session.pinCurrent();
    session.shuffle();
    const current = session.map();
    session.updateDraft({ type, changes: { seed: 'unfinished draft' } });
    const draft = session.draft();
    const history = session.shuffleHistory();
    const spies = [
      vi.spyOn(dungeon, 'shuffleDetails'),
      vi.spyOn(forest, 'shuffleForestDetails'),
      vi.spyOn(courtyard, 'shuffleCourtyardDetails'),
      vi.spyOn(generation, 'generateDungeon'),
      vi.spyOn(forest, 'generateForestClearing'),
      vi.spyOn(courtyard, 'generateCourtyard'),
    ];
    session.selectCandidate('pinned');
    expect(session.map()).toBe(pinned);
    expect(session.currentMap()).toBe(current);
    expect(session.pending()).toBe(true);
    session.pinCurrent(); // A disabled replacement cannot silently replace the visible pin.
    expect(session.comparison().pinned).toBe(pinned);
    session.selectCandidate('current');
    expect(session.map()).toBe(current);
    session.pinCurrent();
    expect(session.comparison().pinned).toBe(current);
    session.selectCandidate('pinned');
    session.clearPin();
    expect(session.map()).toBe(current);
    expect(session.comparison()).toEqual({ selected: 'current' });
    session.selectCandidate('pinned');
    expect(session.map()).toBe(current);
    expect(session.draft()).toBe(draft);
    expect(session.shuffleHistory()).toEqual(history);
    expect(pinned).toEqual(snapshot);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  test(`${type} Generate and Open change Current while retaining the pinned reference`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    const pinned = session.map();
    session.pinCurrent();
    session.selectCandidate('pinned');
    session.updateDraft({ type, changes: { seed: `comparison-${type}` } });
    expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
    expect(session.comparison()).toEqual({ pinned, selected: 'current' });
    expect(session.map().seed).toBe(`comparison-${type}`);
    expect(session.pending()).toBe(false);
    session.selectCandidate('pinned');
    expect(session.map()).toBe(pinned);
    // An unchanged submission does not switch candidates or clear history.
    expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
    expect(session.comparison().selected).toBe('pinned');
    session.openSaved(pinned);
    expect(session.currentMap()).toBe(pinned);
    expect(session.comparison()).toEqual({ pinned, selected: 'current' });
    expect(session.pending()).toBe(false);
  });

  test(`${type} Shuffle and history operate on Current even when Pinned is displayed`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    session.pinCurrent();
    const pinned = session.map();
    session.shuffle();
    const first = session.map();
    session.selectCandidate('pinned');
    session.updateDraft({ type, changes: { seed: '' } });
    const draft = session.draft();
    expect(session.shuffle()).toBe(true);
    const second = session.map();
    expect(second.decoration.revision).toBe(2);
    expect(session.comparison().selected).toBe('current');
    session.selectCandidate('pinned');
    session.undoShuffle();
    expect(session.map()).toBe(first);
    session.selectCandidate('pinned');
    session.redoShuffle();
    expect(session.map()).toBe(second);
    expect(session.comparison().pinned).toBe(pinned);
    expect(session.draft()).toBe(draft);
  });

  test(`${type} rejected generation and shuffle retain both candidates and selection`, () => {
    const session = new WorkbenchSession();
    session.selectMapType(type);
    session.pinCurrent();
    session.shuffle();
    const current = session.map();
    session.selectCandidate('pinned');
    const comparison = session.comparison();
    session.updateDraft({ type, changes: { seed: '' } });
    expect(session.generate().ok).toBe(false);
    if (type === 'dungeon') vi.spyOn(dungeon, 'shuffleDetails').mockImplementation((map) => map);
    if (type === 'forest')
      vi.spyOn(forest, 'shuffleForestDetails').mockImplementation((map) => map);
    if (type === 'courtyard')
      vi.spyOn(courtyard, 'shuffleCourtyardDetails').mockImplementation((map) => map);
    expect(session.shuffle()).toBe(false);
    expect(session.comparison()).toBe(comparison);
    expect(session.currentMap()).toBe(current);
    session.resetChanges();
    expect(session.pending()).toBe(false);
    expect(session.comparison()).toBe(comparison);
  });
}

test('pins and selected candidates are isolated by map type and cleared by a fresh session', () => {
  const session = new WorkbenchSession();
  for (const type of ['dungeon', 'forest', 'courtyard'] as const) {
    session.selectMapType(type);
    expect(session.comparison()).toEqual({ selected: 'current' });
    session.pinCurrent();
    session.shuffle();
    session.selectCandidate('pinned');
  }
  for (const type of ['dungeon', 'forest', 'courtyard'] as const) {
    session.selectMapType(type);
    expect(session.comparison().selected).toBe('pinned');
    expect(session.map().type).toBe(type);
    expect(session.map().decoration.revision).toBe(0);
    expect(session.currentMap().decoration.revision).toBe(1);
  }
  session.clearPin();
  session.selectMapType('forest');
  expect(session.comparison().pinned).toBeDefined();
  const fresh = new WorkbenchSession();
  for (const type of ['dungeon', 'forest', 'courtyard'] as const) {
    fresh.selectMapType(type);
    expect(fresh.comparison()).toEqual({ selected: 'current' });
  }
});
