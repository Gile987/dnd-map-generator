import { afterEach, expect, test, vi } from 'vitest';
import * as engine from '../engine/courtyard-generate';
import { WorkbenchSession } from './workbench-session';

afterEach(() => vi.restoreAllMocks());

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
