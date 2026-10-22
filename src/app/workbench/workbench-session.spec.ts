import '@angular/compiler';
import { Injector } from '@angular/core';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as dungeonEngine from '../engine/generate';
import * as forestEngine from '../engine/forest-generate';
import type { MapType } from '../engine/model';
import { WorkbenchSession } from './workbench-session';

afterEach(() => vi.restoreAllMocks());

describe('workbench session transitions', () => {
  test('generates each initial map once and restores the same accepted models when switching', () => {
    const dungeonGeneration = vi.spyOn(dungeonEngine, 'generateDungeon');
    const forestGeneration = vi.spyOn(forestEngine, 'generateForestClearing');
    const session = new WorkbenchSession();
    const dungeon = session.map();
    expect(session.mapType()).toBe('dungeon');
    expect(session.pending()).toBe(false);
    session.selectMapType('forest');
    const forest = session.map();
    expect(forest.type).toBe('forest');
    expect(session.pending()).toBe(false);
    for (let i = 0; i < 3; i++) {
      session.selectMapType('dungeon');
      expect(session.map()).toBe(dungeon);
      session.selectMapType('forest');
      expect(session.map()).toBe(forest);
    }
    expect(dungeonGeneration).toHaveBeenCalledTimes(1);
    expect(forestGeneration).toHaveBeenCalledTimes(1);
  });

  test('separate component-style injectors own independent sessions', () => {
    const firstInjector = Injector.create({ providers: [WorkbenchSession] });
    const secondInjector = Injector.create({ providers: [WorkbenchSession] });
    try {
      const first = firstInjector.get(WorkbenchSession);
      const second = secondInjector.get(WorkbenchSession);
      expect(first).not.toBe(second);
      first.updateDraft({ type: 'dungeon', changes: { seed: 'first-session' } });
      expect(first.generate().ok).toBe(true);
      first.selectMapType('forest');
      expect(second.mapType()).toBe('dungeon');
      expect(second.map().seed).toBe('mosslit-sanctum');
      expect(second.draft().seed).toBe('mosslit-sanctum');
      expect(second.pending()).toBe(false);
    } finally {
      firstInjector.destroy();
      secondInjector.destroy();
    }
  });

  test('retains independent raw drafts and resets only the active type', () => {
    const session = new WorkbenchSession();
    const dungeon = session.map();
    session.updateDraft({
      type: 'dungeon',
      changes: { seed: 'dungeon-draft', rooms: '4.5', preset: 'Crypt' },
    });
    expect(session.map()).toBe(dungeon);
    session.selectMapType('forest');
    const forest = session.map();
    session.updateDraft({
      type: 'forest',
      changes: { seed: 'forest-draft', character: 'Fey', density: 'Sparse' },
    });
    expect(session.map()).toBe(forest);
    session.selectMapType('dungeon');
    expect(session.draft()).toMatchObject({ seed: 'dungeon-draft', rooms: '4.5', preset: 'Crypt' });
    expect(session.pending()).toBe(true);
    session.resetChanges();
    expect(session.pending()).toBe(false);
    expect(session.draft()).toMatchObject({ seed: dungeon.seed, rooms: '6', preset: 'Mosslit' });
    session.selectMapType('forest');
    expect(session.draft()).toMatchObject({
      seed: 'forest-draft',
      character: 'Fey',
      density: 'Sparse',
    });
    expect(session.map()).toBe(forest);
    expect(session.pending()).toBe(true);
  });

  test.each(['dungeon', 'forest'] as const)(
    'ignores late %s edits after switching map type',
    (type) => {
      const session = new WorkbenchSession();
      session.selectMapType(type);
      const sourceDraft = session.draft();
      const sourceMap = session.map();
      session.selectMapType(type === 'dungeon' ? 'forest' : 'dungeon');
      const activeDraft = session.draft();
      const activeMap = session.map();
      session.updateDraft(
        type === 'dungeon'
          ? { type: 'dungeon', changes: { seed: 'late-dungeon', rooms: '', preset: 'Crypt' } }
          : { type: 'forest', changes: { seed: 'late-forest', character: 'Fey' } },
      );
      expect(session.draft()).toBe(activeDraft);
      expect(session.map()).toBe(activeMap);
      expect(session.pending()).toBe(false);
      session.selectMapType(type);
      expect(session.draft()).toBe(sourceDraft);
      expect(session.map()).toBe(sourceMap);
      expect(session.pending()).toBe(false);
    },
  );

  test('invalid drafts keep the accepted map and raw input, and a corrected draft can generate', () => {
    const session = new WorkbenchSession();
    const original = session.map();
    session.updateDraft({ type: 'dungeon', changes: { seed: '', rooms: '4.5' } });
    expect(session.generate()).toEqual({
      ok: false,
      error: 'Enter a seed between 1 and 64 characters.',
    });
    expect(session.map()).toBe(original);
    expect(session.draft().seed).toBe('');
    session.updateDraft({ type: 'dungeon', changes: { seed: 'configured-crypt' } });
    expect(session.generate()).toEqual({
      ok: false,
      error: 'Choose a whole number of rooms from 4 to 8.',
    });
    expect(session.map()).toBe(original);
    expect(session.draft()).toMatchObject({ type: 'dungeon', rooms: '4.5' });
    session.updateDraft({
      type: 'dungeon',
      changes: { rooms: '4', preset: 'Crypt', density: 'Cluttered' },
    });
    expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
    const generated = session.map();
    if (generated.type !== 'dungeon') throw new Error('Expected dungeon');
    expect(generated.seed).toBe('configured-crypt');
    expect(generated.layout.rooms).toHaveLength(4);
    expect(generated.decoration).toMatchObject({
      preset: 'Crypt',
      density: 'Cluttered',
      revision: 0,
    });
    expect(session.draft().seed).toBe(generated.seed);
    expect(session.pending()).toBe(false);
    session.selectMapType('forest');
    session.selectMapType('dungeon');
    expect(session.map()).toBe(generated);
  });

  test.each(['dungeon', 'forest'] as const)(
    '%s appearance changes and shuffling use accepted settings and retain layout and revision',
    (type) => {
      const session = new WorkbenchSession();
      session.selectMapType(type);
      const original = session.map();
      session.updateDraft(
        type === 'dungeon'
          ? { type: 'dungeon', changes: { preset: 'Crypt', density: 'Cluttered' } }
          : { type: 'forest', changes: { character: 'Autumn', density: 'Cluttered' } },
      );
      const draft = session.draft();
      session.shuffle();
      const shuffled = session.map();
      expect(shuffled.layout).toBe(original.layout);
      expect(shuffled.surfaceSeed).toBe(original.surfaceSeed);
      expect(shuffled.decoration).toMatchObject({
        ...original.decoration,
        props: expect.any(Array),
        revision: 1,
      });
      expect(session.draft()).toBe(draft);
      expect(session.pending()).toBe(true);
      expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
      const applied = session.map();
      expect(applied.layout).toBe(original.layout);
      expect(applied.surfaceSeed).toBe(original.surfaceSeed);
      expect(applied.seed).toBe(original.seed);
      expect(applied.decoration).toMatchObject(
        type === 'dungeon'
          ? { preset: 'Crypt', density: 'Cluttered', revision: 1 }
          : { character: 'Autumn', density: 'Cluttered', revision: 1 },
      );
      expect(session.pending()).toBe(false);
      session.selectMapType(type === 'dungeon' ? 'forest' : 'dungeon');
      session.selectMapType(type);
      expect(session.map()).toBe(applied);
    },
  );

  test.each(['dungeon', 'forest'] as const)(
    'new %s layouts reset revision and leave the other accepted map intact',
    (type) => {
      const session = new WorkbenchSession();
      const otherType: MapType = type === 'dungeon' ? 'forest' : 'dungeon';
      session.selectMapType(otherType);
      const other = session.map();
      session.selectMapType(type);
      session.shuffle();
      const original = session.map();
      const dungeonGeneration = vi.spyOn(dungeonEngine, 'generateDungeon');
      const forestGeneration = vi.spyOn(forestEngine, 'generateForestClearing');
      session.updateDraft({ type, changes: { seed: 'session-new-layout' } });
      expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
      const generated = session.map();
      expect(generated.layout).not.toEqual(original.layout);
      expect(generated.seed).toBe('session-new-layout');
      if (type === 'dungeon') {
        expect(dungeonGeneration).toHaveBeenCalledExactlyOnceWith({
          seed: 'session-new-layout',
          roomCount: 6,
          density: 'Balanced',
          preset: 'Mosslit',
        });
        expect(forestGeneration).not.toHaveBeenCalled();
      } else {
        expect(forestGeneration).toHaveBeenCalledExactlyOnceWith({
          seed: 'session-new-layout',
          density: 'Balanced',
          character: 'Verdant',
        });
        expect(dungeonGeneration).not.toHaveBeenCalled();
      }
      expect(generated.decoration.revision).toBe(0);
      expect(session.pending()).toBe(false);
      session.selectMapType(otherType);
      expect(session.map()).toBe(other);
      session.selectMapType(type);
      expect(session.map()).toBe(generated);
    },
  );

  test('opening a saved forest restores accepted controls and preserves the other type draft', () => {
    const session = new WorkbenchSession();
    const dungeon = session.map();
    session.updateDraft({ type: 'dungeon', changes: { seed: 'kept-dungeon-draft', rooms: '4.5' } });
    session.selectMapType('forest');
    session.updateDraft({
      type: 'forest',
      changes: { seed: 'discarded-forest-draft', character: 'Fey' },
    });
    const saved = forestEngine.generateForestClearing({
      seed: 'saved-autumn',
      density: 'Sparse',
      character: 'Autumn',
    });
    if (!saved.ok) throw new Error(saved.error);
    session.openSaved(saved.map);
    expect(session.mapType()).toBe('forest');
    expect(session.map()).toBe(saved.map);
    expect(session.draft()).toMatchObject({
      seed: 'saved-autumn',
      density: 'Sparse',
      character: 'Autumn',
    });
    expect(session.pending()).toBe(false);
    session.selectMapType('dungeon');
    expect(session.map()).toBe(dungeon);
    expect(session.draft()).toMatchObject({ seed: 'kept-dungeon-draft', rooms: '4.5' });
    session.selectMapType('forest');
    expect(session.map()).toBe(saved.map);
  });

  test.each(['dungeon', 'forest'] as const)(
    'a failed %s generation preserves accepted maps and the draft, and permits retry',
    (type) => {
      const session = new WorkbenchSession();
      session.selectMapType(type);
      const original = session.map();
      session.updateDraft({ type, changes: { seed: 'retry-layout' } });
      const draft = session.draft();
      if (type === 'dungeon')
        vi.spyOn(dungeonEngine, 'generateDungeon').mockReturnValueOnce({
          ok: false,
          error: 'Bounded placement failed.',
        });
      else
        vi.spyOn(forestEngine, 'generateForestClearing').mockReturnValueOnce({
          ok: false,
          error: 'Bounded placement failed.',
        });
      expect(session.generate()).toEqual({ ok: false, error: 'Bounded placement failed.' });
      expect(session.map()).toBe(original);
      expect(session.draft()).toBe(draft);
      expect(session.pending()).toBe(true);
      session.selectMapType(type === 'dungeon' ? 'forest' : 'dungeon');
      session.selectMapType(type);
      expect(session.map()).toBe(original);
      expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
      expect(session.map().seed).toBe('retry-layout');
      expect(session.pending()).toBe(false);
    },
  );

  test('generating unchanged settings leaves the accepted map untouched', () => {
    const session = new WorkbenchSession();
    const original = session.map();
    expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
    expect(session.map()).toBe(original);
    expect(session.pending()).toBe(false);
  });

  test.each(['dungeon', 'forest'] as const)(
    '%s shuffle exhaustion retains accepted maps and drafts and permits a new layout',
    (type) => {
      const session = new WorkbenchSession();
      session.selectMapType(type);
      const original = session.map();
      const map =
        original.type === 'dungeon'
          ? {
              ...original,
              decoration: { ...original.decoration, revision: Number.MAX_SAFE_INTEGER },
            }
          : {
              ...original,
              decoration: { ...original.decoration, revision: Number.MAX_SAFE_INTEGER },
            };
      session.openSaved(map);
      session.updateDraft({ type, changes: { seed: 'revision-recovery' } });
      const draft = session.draft();
      expect(() => session.shuffle()).toThrow('detail revision limit');
      expect(session.map()).toBe(map);
      expect(session.draft()).toBe(draft);
      expect(session.pending()).toBe(true);
      expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
      expect(session.map().seed).toBe('revision-recovery');
      expect(session.map().decoration.revision).toBe(0);
      session.shuffle();
      expect(session.map().decoration.revision).toBe(1);
    },
  );

  test('a rejected forest character does not partially commit a combined appearance change', () => {
    const session = new WorkbenchSession();
    session.selectMapType('forest');
    const original = session.map();
    session.updateDraft({ type: 'forest', changes: { character: 'Fey', density: 'Cluttered' } });
    const draft = session.draft();
    vi.spyOn(forestEngine, 'changeForestCharacter').mockImplementationOnce((map) => map);
    expect(session.generate()).toEqual({
      ok: false,
      error: 'That forest character could not be applied. Try another seed.',
    });
    expect(session.map()).toBe(original);
    expect(session.draft()).toBe(draft);
    expect(session.pending()).toBe(true);
    expect(session.generate()).toEqual({ ok: true, layoutChanged: false });
    expect(session.map().decoration).toMatchObject({ character: 'Fey', density: 'Cluttered' });
    expect(session.map().layout).toBe(original.layout);
    expect(session.pending()).toBe(false);
  });

  test('an unexpected engine exception leaves the accepted map and draft available for retry', () => {
    const session = new WorkbenchSession();
    const original = session.map();
    session.updateDraft({ type: 'dungeon', changes: { seed: 'retry-after-exception' } });
    const draft = session.draft();
    vi.spyOn(dungeonEngine, 'generateDungeon').mockImplementationOnce(() => {
      throw new Error('Drawing-independent engine failure');
    });
    expect(() => session.generate()).toThrow('Drawing-independent engine failure');
    expect(session.map()).toBe(original);
    expect(session.draft()).toBe(draft);
    expect(session.pending()).toBe(true);
    expect(session.generate()).toEqual({ ok: true, layoutChanged: true });
    expect(session.map().seed).toBe('retry-after-exception');
  });
});
