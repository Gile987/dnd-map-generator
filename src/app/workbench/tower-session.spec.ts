import '@angular/compiler';
import { expect, test, vi } from 'vitest';
import * as laboratory from '../engine/tower-laboratory';
import * as observatory from '../engine/tower-observatory';
import { WorkbenchSession } from './workbench-session';
import { pendingSettingChanges } from './pending-changes';

test('observatory drafts, conflicts, refusal and retry preserve accepted maps, pins and history', () => {
  const session = new WorkbenchSession();
  session.selectMapType('tower');
  session.updateDraft({ type: 'tower', changes: { laboratoryFloor: '2' } });
  expect(session.generate().ok).toBe(true);
  session.pinCurrent();
  session.shuffle();
  const original = session.map();
  session.updateDraft({ type: 'tower', changes: { observatoryFloor: '4', density: 'Sparse' } });
  expect(session.generationEffect()).toBe('appearance');
  expect(pendingSettingChanges(original, session.draft())).toContainEqual({
    label: 'Observatory floor',
    before: 'None',
    after: 'Floor 4',
  });
  session.selectMapType('forest');
  session.selectMapType('tower');
  const draft = session.draft(),
    comparison = session.comparison(),
    history = session.shuffleHistory();
  const placement = vi.spyOn(observatory, 'towerObservatoryProps').mockReturnValue(undefined);
  try {
    expect(session.generate()).toEqual({
      ok: false,
      error: 'Those tower additions could not fit. Try another floor or seed.',
    });
    expect(session.map()).toBe(original);
    expect(session.draft()).toBe(draft);
    expect(session.comparison()).toBe(comparison);
    expect(session.shuffleHistory()).toEqual(history);
  } finally {
    placement.mockRestore();
  }
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  const accepted = session.map();
  expect(accepted.layout).toBe(original.layout);
  expect(accepted.decoration).toMatchObject({
    observatoryFloor: 4,
    laboratoryFloor: 2,
    density: 'Sparse',
    revision: original.decoration.revision,
  });
  session.updateDraft({ type: 'tower', changes: { observatoryFloor: '2' } });
  expect(session.validationError()).toContain('different floors');
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(accepted);
  session.resetChanges();
  expect(session.pending()).toBe(false);
  session.updateDraft({ type: 'tower', changes: { observatoryFloor: 'none' } });
  session.shuffle();
  session.undoShuffle();
  expect(session.map()).toBe(accepted);
  expect(session.draft()).toMatchObject({ observatoryFloor: 'none' });
  session.openSaved(accepted);
  expect(session.draft()).toMatchObject({ observatoryFloor: '4' });
  session.updateDraft({ type: 'tower', changes: { observatoryFloor: 'none' } });
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  expect(session.map().decoration).not.toHaveProperty('observatoryFloor');
  expect(session.map().decoration).toMatchObject({ laboratoryFloor: 2 });
});

test('refused laboratory and density changes report the laboratory failure and recover without losing state', () => {
  const session = new WorkbenchSession();
  session.selectMapType('tower');
  session.pinCurrent();
  session.shuffle();
  session.updateDraft({ type: 'tower', changes: { laboratoryFloor: '2', density: 'Sparse' } });
  const accepted = session.map();
  const draft = session.draft();
  const comparison = session.comparison();
  const history = session.shuffleHistory();
  const placement = vi.spyOn(laboratory, 'towerLaboratoryProps').mockReturnValue(undefined);
  try {
    expect(session.generate()).toEqual({
      ok: false,
      error: 'That laboratory could not fit on that floor. Try another floor or seed.',
    });
    expect(session.map()).toBe(accepted);
    expect(session.currentMap()).toBe(accepted);
    expect(session.draft()).toBe(draft);
    expect(session.comparison()).toBe(comparison);
    expect(session.shuffleHistory()).toEqual(history);
    expect(session.pending()).toBe(true);
  } finally {
    placement.mockRestore();
  }
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  expect(session.map().layout).toBe(accepted.layout);
  expect(session.map().decoration).toMatchObject({
    laboratoryFloor: 2,
    density: 'Sparse',
    revision: accepted.decoration.revision,
  });
  expect(session.pending()).toBe(false);
});

test('tower drafts, pins, retained maps, density, shuffle history, rejection and recovery follow the workbench contract', () => {
  const session = new WorkbenchSession(),
    dungeon = session.map();
  session.selectMapType('tower');
  const initial = session.map();
  expect(initial.type).toBe('tower');
  expect(session.pending()).toBe(false);
  session.updateDraft({ type: 'tower', changes: { floors: '8', portalFloor: '3' } });
  expect(session.map()).toBe(initial);
  expect(session.generationEffect()).toBe('layout');
  expect(pendingSettingChanges(initial, session.draft()).map((c) => c.label)).toEqual([
    'Floors',
    'Secret portal',
  ]);
  session.selectMapType('dungeon');
  expect(session.map()).toBe(dungeon);
  session.selectMapType('tower');
  expect(session.pending()).toBe(true);
  expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
  const accepted = session.map();
  if (accepted.type !== 'tower') throw new Error('Expected tower');
  expect(accepted.layout.floors).toHaveLength(8);
  expect(accepted.layout.portalFloor).toBe(3);
  session.pinCurrent();
  session.updateDraft({ type: 'tower', changes: { density: 'Sparse' } });
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  expect(session.map().layout).toBe(accepted.layout);
  const sparse = session.map();
  session.updateDraft({ type: 'tower', changes: { seed: 'pending' } });
  const draft = session.draft();
  expect(session.shuffle()).toBe(true);
  const shuffled = session.map();
  expect(shuffled.layout).toBe(sparse.layout);
  session.undoShuffle();
  expect(session.map()).toBe(sparse);
  session.redoShuffle();
  expect(session.map()).toBe(shuffled);
  expect(session.draft()).toBe(draft);
  session.selectCandidate('pinned');
  expect(session.map()).toBe(accepted);
  session.updateDraft({ type: 'tower', changes: { floors: '2' } });
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(accepted);
  expect(session.currentMap()).toBe(shuffled);
  session.resetChanges();
  expect(session.pending()).toBe(false);
  session.openSaved(accepted);
  expect(session.map()).toBe(accepted);
  expect(session.shuffleHistory().undo).toBe(0);
  expect(session.draft()).toMatchObject({ floors: '8', portalFloor: '3' });
  session.updateDraft({ type: 'tower', changes: { portalFloor: 'none' } });
  expect(session.generate().ok).toBe(true);
  const regular = session.map();
  if (regular.type !== 'tower') throw new Error('Expected tower');
  expect(regular.layout.connections.every((c) => c.kind === 'stairs')).toBe(true);
});

test('staircase choices remain drafts, reset and retain independently, then generate and persist with their map', () => {
  const session = new WorkbenchSession();
  session.selectMapType('tower');
  const initial = session.map();
  session.updateDraft({ type: 'tower', changes: { stairStyle: 'separate' } });
  expect(session.map()).toBe(initial);
  expect(session.pending()).toBe(true);
  expect(session.generationEffect()).toBe('layout');
  expect(pendingSettingChanges(initial, session.draft())).toContainEqual({
    label: 'Staircase style',
    before: 'Shared spiral',
    after: 'Separate stairs',
  });
  session.selectMapType('forest');
  session.selectMapType('tower');
  expect(session.draft()).toMatchObject({ stairStyle: 'separate' });
  session.resetChanges();
  expect(session.draft()).toMatchObject({ stairStyle: 'spiral' });
  expect(session.pending()).toBe(false);
  session.updateDraft({ type: 'tower', changes: { stairStyle: 'separate' } });
  expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
  const separate = session.map();
  if (separate.type !== 'tower') throw new Error('Expected tower');
  expect(separate.layout.stairStyle).toBe('separate');
  session.updateDraft({ type: 'tower', changes: { stairStyle: 'spiral' } });
  expect(session.shuffle()).toBe(true);
  expect(session.currentMap().layout).toBe(separate.layout);
  session.undoShuffle();
  expect(session.map()).toBe(separate);
  expect(session.draft()).toMatchObject({ stairStyle: 'spiral' });
  session.openSaved(separate);
  expect(session.draft()).toMatchObject({ stairStyle: 'separate' });
  expect(session.pending()).toBe(false);
  session.updateDraft({ type: 'tower', changes: { stairStyle: 'invalid' as never } });
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(separate);
  session.resetChanges();
  expect(session.pending()).toBe(false);
});

test('laboratory choices retain accepted maps, drafts, pins and history until a successful appearance commit', () => {
  const session = new WorkbenchSession();
  session.selectMapType('tower');
  const original = session.map();
  session.shuffle();
  const shuffled = session.map();
  session.pinCurrent();
  session.updateDraft({ type: 'tower', changes: { laboratoryFloor: '2' } });
  expect(session.pending()).toBe(true);
  expect(session.generationEffect()).toBe('appearance');
  expect(session.map()).toBe(shuffled);
  session.selectMapType('forest');
  session.selectMapType('tower');
  expect(session.draft()).toMatchObject({ laboratoryFloor: '2' });
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  const accepted = session.map();
  if (accepted.type !== 'tower') throw new Error('Expected tower');
  expect(accepted.decoration.laboratoryFloor).toBe(2);
  expect(accepted.layout).toBe(original.layout);
  expect(accepted.decoration.revision).toBe(shuffled.decoration.revision);
  expect(session.shuffleHistory().undo).toBe(0);
  session.updateDraft({ type: 'tower', changes: { laboratoryFloor: '3' } });
  session.shuffle();
  session.undoShuffle();
  expect(session.map()).toBe(accepted);
  expect(session.draft()).toMatchObject({ laboratoryFloor: '3' });
  session.resetChanges();
  expect(session.draft()).toMatchObject({ laboratoryFloor: '2' });
  expect(session.pending()).toBe(false);
  session.openSaved(accepted);
  expect(session.draft()).toMatchObject({ laboratoryFloor: '2' });
  session.updateDraft({ type: 'tower', changes: { laboratoryFloor: '99' } });
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(accepted);
  expect(session.draft()).toMatchObject({ laboratoryFloor: '99' });
  session.resetChanges();
  expect(session.pending()).toBe(false);
  session.updateDraft({ type: 'tower', changes: { laboratoryFloor: 'none' } });
  expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
  const removed = session.map();
  expect(removed.decoration).not.toHaveProperty('laboratoryFloor');
  expect(removed.decoration.props.some((p) => p.kind === 'cauldron')).toBe(false);
  session.updateDraft({ type: 'tower', changes: { laboratoryFloor: 'invalid' } });
  expect(session.pending()).toBe(true);
  expect(session.validationError()).toContain('laboratory');
  expect(session.generate().ok).toBe(false);
  expect(session.map()).toBe(removed);
});
