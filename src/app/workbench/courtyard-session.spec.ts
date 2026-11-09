import { afterEach, expect, test, vi } from 'vitest';
import * as engine from '../engine/courtyard-generate';
import * as wagon from '../engine/courtyard-wagon';
import { WorkbenchSession } from './workbench-session';

afterEach(() => vi.restoreAllMocks());

test('wagon appearance drafts reject and recover without losing accepted maps, pins or shuffle history', () => {
  const session = new WorkbenchSession();
  session.selectMapType('courtyard');
  session.updateDraft({ type: 'courtyard', changes: { fountain: true } });
  expect(session.generate().ok).toBe(true);
  session.pinCurrent();
  session.shuffle();
  const original = session.map();
  session.updateDraft({ type: 'courtyard', changes: { wagon: true, density: 'Sparse' } });
  expect(session.pending()).toBe(true);
  expect(session.generationEffect()).toBe('appearance');
  session.selectMapType('forest');
  session.selectMapType('courtyard');
  const draft = session.draft(),
    comparison = session.comparison(),
    history = session.shuffleHistory();
  const placement = vi.spyOn(wagon, 'placeCollapsedWagon').mockReturnValue(undefined);
  expect(session.generate()).toEqual({
    ok: false,
    error: 'Those courtyard additions could not fit. Try another seed or remove an addition.',
  });
  expect(session.map()).toBe(original);
  expect(session.draft()).toBe(draft);
  expect(session.comparison()).toBe(comparison);
  expect(session.shuffleHistory()).toEqual(history);
  placement.mockRestore();
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  const accepted = session.map();
  expect(accepted.layout).toBe(original.layout);
  expect(accepted.surfaceSeed).toBe(original.surfaceSeed);
  expect(accepted.decoration).toMatchObject({
    wagon: true,
    fountain: true,
    density: 'Sparse',
    revision: original.decoration.revision,
  });
  session.updateDraft({ type: 'courtyard', changes: { wagon: false } });
  session.shuffle();
  session.undoShuffle();
  expect(session.map()).toBe(accepted);
  expect(session.draft()).toMatchObject({ wagon: false });
  session.resetChanges();
  expect(session.draft()).toMatchObject({ wagon: true });
  expect(session.pending()).toBe(false);
  session.openSaved(accepted);
  expect(session.draft()).toMatchObject({ wagon: true });
  session.updateDraft({ type: 'courtyard', changes: { wagon: false } });
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  expect(session.map().decoration).not.toHaveProperty('wagon');
});

test('courtyard drafts, accepted maps and history remain independent from both other map types', () => {
  const session = new WorkbenchSession();
  const dungeon = session.map();
  session.updateDraft({ type: 'dungeon', changes: { seed: 'pending-dungeon' } });
  session.selectMapType('forest');
  const forest = session.map();
  session.shuffle();
  session.updateDraft({ type: 'forest', changes: { seed: 'pending-forest' } });
  session.selectMapType('courtyard');
  const original = session.map();
  session.updateDraft({ type: 'courtyard', changes: { fountain: true } });
  expect(session.map()).toBe(original);
  expect(session.pending()).toBe(true);
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  const fountain = session.map();
  expect(fountain.layout).toBe(original.layout);
  expect(fountain.decoration.props.some((p) => p.kind === 'dry_fountain')).toBe(true);
  const reproduced = engine.generateCourtyard({
    character: 'Overgrown',
    seed: fountain.seed,
    density: 'Balanced',
    fountain: true,
  });
  expect(reproduced).toEqual({ ok: true, map: fountain });
  expect(session.shuffle()).toBe(true);
  const shuffled = session.map();
  session.updateDraft({
    type: 'courtyard',
    changes: { seed: 'pending-courtyard', density: 'Cluttered' },
  });
  const pending = session.draft();
  session.undoShuffle();
  expect(session.map()).toBe(fountain);
  session.redoShuffle();
  expect(session.map()).toBe(shuffled);
  expect(session.draft()).toBe(pending);
  session.selectMapType('dungeon');
  expect(session.map()).toBe(dungeon);
  expect(session.draft().seed).toBe('pending-dungeon');
  session.selectMapType('forest');
  expect(session.map()).not.toBe(forest);
  expect(session.draft().seed).toBe('pending-forest');
  expect(session.shuffleHistory().undo).toBe(1);
  session.selectMapType('courtyard');
  expect(session.map()).toBe(shuffled);
  expect(session.draft()).toBe(pending);
  session.openSaved(fountain);
  expect(session.pending()).toBe(false);
  expect(session.shuffleHistory().undo).toBe(0);
  session.selectMapType('forest');
  expect(session.shuffleHistory().undo).toBe(1);
});

test('courtyard rejection preserves accepted artwork, drafts and history, then recovers', () => {
  const session = new WorkbenchSession();
  session.selectMapType('courtyard');
  session.shuffle();
  const map = session.map();
  session.updateDraft({ type: 'courtyard', changes: { seed: ' ' } });
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(map);
  expect(session.shuffleHistory().undo).toBe(1);
  session.updateDraft({ type: 'courtyard', changes: { seed: 'ruin-retry' } });
  const draft = session.draft();
  const spy = vi
    .spyOn(engine, 'generateCourtyard')
    .mockReturnValueOnce({ ok: false, error: 'Try another seed.' });
  expect(session.generate()).toEqual({ ok: false, error: 'Try another seed.' });
  expect(session.map()).toBe(map);
  expect(session.draft()).toBe(draft);
  expect(session.shuffleHistory().undo).toBe(1);
  spy.mockRestore();
  expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
  expect(session.map().seed).toBe('ruin-retry');
  expect(session.map().decoration.revision).toBe(0);
  expect(session.shuffleHistory()).toEqual({ undo: 0, redo: 0, limit: 20 });
  session.updateDraft({ type: 'courtyard', changes: { fountain: true } });
  expect(session.generate().ok).toBe(true);
  const accepted = session.map();
  session.updateDraft({ type: 'courtyard', changes: { fountain: false } });
  vi.spyOn(engine, 'changeCourtyardAppearance').mockImplementationOnce((map) => map);
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(accepted);
  expect(session.pending()).toBe(true);
  expect(session.generate().ok).toBe(true);
  expect(session.pending()).toBe(false);
});
