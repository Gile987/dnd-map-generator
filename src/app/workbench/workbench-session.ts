import type { Tower } from '../engine/tower';
import {
  generateTower,
  changeTowerAppearance,
  shuffleTowerDetails,
  towerStairStyle,
  DEFAULT_TOWER_STAIR_STYLE,
} from '../engine/tower';
import { Injectable, computed, signal } from '@angular/core';
import {
  changeDensity,
  changePreset,
  changeDungeonAppearance,
  shuffleDetails,
} from '../engine/decoration';
import {
  changeForestCharacter,
  changeForestAppearance,
  changeForestDensity,
  generateForestClearing,
  shuffleForestDetails,
} from '../engine/forest-generate';
import { generateDungeon } from '../engine/generate';
import {
  generateCourtyard,
  changeCourtyardAppearance,
  shuffleCourtyardDetails,
} from '../engine/courtyard-generate';
import { DEFAULT_FOREST_CHARACTER, DEFAULT_PRESET } from '../engine/model';
import type {
  Dungeon,
  ForestClearing,
  GeneratedMap,
  MapType,
  RuinedCourtyard,
} from '../engine/model';
import {
  towerDraftForMap,
  dungeonDraftForMap,
  forestDraftForMap,
  courtyardDraftForMap,
  parseDraft,
} from './settings-draft';
import type { DraftChange, SettingsDrafts } from './settings-draft';

const SHUFFLE_HISTORY_LIMIT = 20;

interface ShuffleHistory<T extends GeneratedMap> {
  readonly past: readonly T[];
  readonly future: readonly T[];
}

export interface ShuffleHistoryStatus {
  readonly undo: number;
  readonly redo: number;
  readonly limit: number;
}

export type GenerationEffect = 'layout' | 'appearance' | 'invalid';
export type Candidate = 'current' | 'pinned';

interface Comparison {
  readonly pinned?: GeneratedMap;
  readonly selected: Candidate;
}

type Comparisons = Readonly<Record<MapType, Comparison>>;

function showCurrent(comparisons: Comparisons, type: MapType): Comparisons {
  return { ...comparisons, [type]: { ...comparisons[type], selected: 'current' } };
}

interface SessionState {
  readonly comparisons: Comparisons;
  readonly type: MapType;
  readonly maps: {
    readonly dungeon: Dungeon;
    readonly forest: ForestClearing;
    readonly courtyard: RuinedCourtyard;
    readonly tower: Tower;
  };
  readonly drafts: SettingsDrafts;
  readonly histories: {
    readonly dungeon: ShuffleHistory<Dungeon>;
    readonly forest: ShuffleHistory<ForestClearing>;
    readonly courtyard: ShuffleHistory<RuinedCourtyard>;
    readonly tower: ShuffleHistory<Tower>;
  };
}

export type ApplySettingsResult =
  | { readonly ok: true; readonly layoutChanged: boolean }
  | { readonly ok: false; readonly error: string };

function draftsForMap(drafts: SettingsDrafts, map: GeneratedMap): SettingsDrafts {
  if (map.type === 'tower') return { ...drafts, tower: towerDraftForMap(map) };
  if (map.type === 'courtyard') return { ...drafts, courtyard: courtyardDraftForMap(map) };
  return map.type === 'dungeon'
    ? { ...drafts, dungeon: dungeonDraftForMap(map) }
    : { ...drafts, forest: forestDraftForMap(map) };
}

function recordShuffle<T extends GeneratedMap>(
  history: ShuffleHistory<T>,
  current: T,
): ShuffleHistory<T> {
  return { past: [...history.past, current].slice(-SHUFFLE_HISTORY_LIMIT), future: [] };
}

function moveShuffle<T extends GeneratedMap>(
  current: T,
  history: ShuffleHistory<T>,
  direction: 'undo' | 'redo',
): { map: T; history: ShuffleHistory<T> } | undefined {
  const source = direction === 'undo' ? history.past : history.future;
  const next = source.at(-1);
  if (!next) return undefined;
  return {
    map: next,
    history:
      direction === 'undo'
        ? { past: source.slice(0, -1), future: [...history.future, current] }
        : { past: [...history.past, current], future: source.slice(0, -1) },
  };
}

function initialState(): SessionState {
  const dungeon = generateDungeon({
    seed: 'mosslit-sanctum',
    roomCount: 6,
    density: 'Balanced',
    preset: DEFAULT_PRESET,
  });
  if (!dungeon.ok) throw new Error(dungeon.error);
  const forest = generateForestClearing({
    seed: 'mosslit-sanctum',
    density: 'Balanced',
    character: DEFAULT_FOREST_CHARACTER,
  });
  if (!forest.ok) throw new Error(forest.error);
  const courtyard = generateCourtyard({ seed: 'ivy-court', density: 'Balanced', fountain: false });
  if (!courtyard.ok) throw new Error(courtyard.error);
  const tower = generateTower({
    seed: 'astral-watch',
    floorCount: 4,
    portalFloor: null,
    laboratoryFloor: null,
    density: 'Balanced',
  });
  if (!tower.ok) throw new Error(tower.error);
  return {
    type: 'dungeon',
    comparisons: {
      dungeon: { selected: 'current' },
      forest: { selected: 'current' },
      courtyard: { selected: 'current' },
      tower: { selected: 'current' },
    },
    maps: { dungeon: dungeon.map, forest: forest.map, courtyard: courtyard.map, tower: tower.map },
    drafts: {
      dungeon: dungeonDraftForMap(dungeon.map),
      forest: forestDraftForMap(forest.map),
      courtyard: courtyardDraftForMap(courtyard.map),
      tower: towerDraftForMap(tower.map),
    },
    histories: {
      dungeon: { past: [], future: [] },
      forest: { past: [], future: [] },
      courtyard: { past: [], future: [] },
      tower: { past: [], future: [] },
    },
  };
}

@Injectable()
export class WorkbenchSession {
  private readonly state = signal<SessionState>(initialState());
  readonly mapType = computed(() => this.state().type);
  readonly currentMap = computed(() => {
    const state = this.state();
    return state.maps[state.type];
  });
  readonly comparison = computed(() => {
    const state = this.state();
    return state.comparisons[state.type];
  });
  readonly map = computed(() => {
    const comparison = this.comparison();
    return comparison.selected === 'pinned' && comparison.pinned
      ? comparison.pinned
      : this.currentMap();
  });

  readonly draft = computed(() => {
    const state = this.state();
    return state.drafts[state.type];
  });
  readonly shuffleHistory = computed<ShuffleHistoryStatus>(() => {
    const state = this.state();
    const history = state.histories[state.type];
    return { undo: history.past.length, redo: history.future.length, limit: SHUFFLE_HISTORY_LIMIT };
  });
  private readonly layoutPending = computed(() => {
    const state = this.state();
    if (state.type === 'tower') {
      const draft = state.drafts.tower,
        map = state.maps.tower;
      return (
        (draft.stairStyle ?? DEFAULT_TOWER_STAIR_STYLE) !== towerStairStyle(map) ||
        draft.seed.trim() !== map.seed ||
        !/^\d+$/.test(draft.floors) ||
        Number(draft.floors) !== map.layout.floors.length ||
        (draft.portalFloor === 'none' ? null : Number(draft.portalFloor)) !== map.layout.portalFloor
      );
    }
    if (state.type === 'courtyard')
      return state.drafts.courtyard.seed.trim() !== state.maps.courtyard.seed;
    if (state.type === 'forest') return state.drafts.forest.seed.trim() !== state.maps.forest.seed;
    const draft = state.drafts.dungeon;
    const map = state.maps.dungeon;
    return (
      draft.seed.trim() !== map.seed ||
      !/^\d+$/.test(draft.rooms) ||
      Number(draft.rooms) !== map.layout.rooms.length
    );
  });
  readonly pending = computed(() => {
    const state = this.state();
    if (state.type === 'tower') {
      const draft = state.drafts.tower,
        decoration = state.maps.tower.decoration;
      return (
        this.layoutPending() ||
        draft.density !== decoration.density ||
        (draft.laboratoryFloor === 'none'
          ? null
          : /^\d+$/.test(draft.laboratoryFloor)
            ? Number(draft.laboratoryFloor)
            : NaN) !== (decoration.laboratoryFloor ?? null)
      );
    }
    if (state.type === 'courtyard') {
      const draft = state.drafts.courtyard;
      const decoration = state.maps.courtyard.decoration;
      return (
        this.layoutPending() ||
        draft.density !== decoration.density ||
        draft.fountain !== decoration.fountain
      );
    }
    if (state.type === 'forest') {
      const draft = state.drafts.forest;
      const decoration = state.maps.forest.decoration;
      return (
        this.layoutPending() ||
        draft.density !== decoration.density ||
        draft.character !== decoration.character ||
        (draft.landmark ?? 'None') !== (decoration.landmark ?? 'None') ||
        (draft.scene ?? 'None') !== (decoration.scene ?? 'None')
      );
    }
    const draft = state.drafts.dungeon;
    const decoration = state.maps.dungeon.decoration;
    return (
      this.layoutPending() ||
      draft.density !== decoration.density ||
      draft.preset !== decoration.preset ||
      Boolean(draft.ritual) !== Boolean(decoration.ritual) ||
      (draft.furniture ?? 'None') !== (decoration.furniture ?? 'None') ||
      (draft.landmark ?? 'None') !== (decoration.landmark ?? 'None') ||
      (draft.scene ?? 'None') !== (decoration.scene ?? 'None')
    );
  });
  private readonly parsedDraft = computed(() => parseDraft(this.draft()));
  readonly validationError = computed(() => {
    const result = this.parsedDraft();
    return result.ok ? undefined : result.error;
  });
  readonly generationEffect = computed<GenerationEffect>(() =>
    this.validationError() ? 'invalid' : this.layoutPending() ? 'layout' : 'appearance',
  );

  pinCurrent(): void {
    this.state.update((state) =>
      state.comparisons[state.type].selected === 'pinned'
        ? state
        : {
            ...state,
            comparisons: {
              ...state.comparisons,
              [state.type]: { pinned: state.maps[state.type], selected: 'current' },
            },
          },
    );
  }

  selectCandidate(selected: Candidate): void {
    this.state.update((state) => {
      const comparison = state.comparisons[state.type];
      if (selected === comparison.selected || (selected === 'pinned' && !comparison.pinned))
        return state;
      return {
        ...state,
        comparisons: { ...state.comparisons, [state.type]: { ...comparison, selected } },
      };
    });
  }

  clearPin(): void {
    this.state.update((state) => ({
      ...state,
      comparisons: { ...state.comparisons, [state.type]: { selected: 'current' } },
    }));
  }

  selectMapType(type: MapType): void {
    this.state.update((state) => (state.type === type ? state : { ...state, type }));
  }

  updateDraft(change: DraftChange): void {
    this.state.update((state) => {
      if (change.type !== state.type) return state;
      const drafts =
        change.type === 'tower'
          ? { ...state.drafts, tower: { ...state.drafts.tower, ...change.changes } }
          : change.type === 'courtyard'
            ? { ...state.drafts, courtyard: { ...state.drafts.courtyard, ...change.changes } }
            : change.type === 'dungeon'
              ? { ...state.drafts, dungeon: { ...state.drafts.dungeon, ...change.changes } }
              : { ...state.drafts, forest: { ...state.drafts.forest, ...change.changes } };
      return { ...state, drafts };
    });
  }

  resetChanges(): void {
    this.state.update((state) => ({
      ...state,
      drafts: draftsForMap(state.drafts, state.maps[state.type]),
    }));
  }

  openSaved(map: GeneratedMap): void {
    this.state.update((state) => ({
      ...state,
      type: map.type,
      comparisons: showCurrent(state.comparisons, map.type),
      maps:
        map.type === 'tower'
          ? { ...state.maps, tower: map }
          : map.type === 'courtyard'
            ? { ...state.maps, courtyard: map }
            : map.type === 'dungeon'
              ? { ...state.maps, dungeon: map }
              : { ...state.maps, forest: map },
      drafts: draftsForMap(state.drafts, map),
      histories: { ...state.histories, [map.type]: { past: [], future: [] } },
    }));
  }

  shuffle(): boolean {
    const current = this.currentMap();
    const next =
      current.type === 'tower'
        ? shuffleTowerDetails(current)
        : current.type === 'courtyard'
          ? shuffleCourtyardDetails(current)
          : current.type === 'dungeon'
            ? shuffleDetails(current)
            : shuffleForestDetails(current);
    if (next === current) return false;
    this.accept(next, false);
    return true;
  }

  undoShuffle(): void {
    this.restoreShuffle('undo');
  }

  redoShuffle(): void {
    this.restoreShuffle('redo');
  }

  private restoreShuffle(direction: 'undo' | 'redo'): void {
    this.state.update((state) => {
      if (state.type === 'tower') {
        const next = moveShuffle(state.maps.tower, state.histories.tower, direction);
        return next
          ? {
              ...state,
              maps: { ...state.maps, tower: next.map },
              comparisons: showCurrent(state.comparisons, state.type),
              histories: { ...state.histories, tower: next.history },
            }
          : state;
      }
      if (state.type === 'courtyard') {
        const next = moveShuffle(state.maps.courtyard, state.histories.courtyard, direction);
        return next
          ? {
              ...state,
              maps: { ...state.maps, courtyard: next.map },
              comparisons: showCurrent(state.comparisons, state.type),
              histories: { ...state.histories, courtyard: next.history },
            }
          : state;
      }
      if (state.type === 'dungeon') {
        const next = moveShuffle(state.maps.dungeon, state.histories.dungeon, direction);
        return next
          ? {
              ...state,
              maps: { ...state.maps, dungeon: next.map },
              comparisons: showCurrent(state.comparisons, state.type),
              histories: { ...state.histories, dungeon: next.history },
            }
          : state;
      }
      const next = moveShuffle(state.maps.forest, state.histories.forest, direction);
      return next
        ? {
            ...state,
            maps: { ...state.maps, forest: next.map },
            comparisons: showCurrent(state.comparisons, state.type),
            histories: { ...state.histories, forest: next.history },
          }
        : state;
    });
  }

  generate(): ApplySettingsResult {
    if (!this.pending()) return { ok: true, layoutChanged: false };
    const parsed = this.parsedDraft();
    if (!parsed.ok) return parsed;
    const state = this.state();
    const layoutChanged = this.layoutPending();
    let next: GeneratedMap;
    if (parsed.type === 'tower') {
      if (layoutChanged) {
        const result = generateTower(parsed.settings);
        if (!result.ok) return result;
        next = result.map;
      } else next = changeTowerAppearance(state.maps.tower, parsed.settings);
    } else if (parsed.type === 'courtyard') {
      if (layoutChanged) {
        const result = generateCourtyard(parsed.settings);
        if (!result.ok) return result;
        next = result.map;
      } else {
        next = changeCourtyardAppearance(state.maps.courtyard, parsed.settings);
      }
      if (
        next.decoration.fountain !== parsed.settings.fountain ||
        next.decoration.density !== parsed.settings.density
      )
        return {
          ok: false,
          error:
            'Those courtyard additions could not fit. Try another seed or remove the fountain.',
        };
    } else if (parsed.type === 'forest') {
      const settings = parsed.settings;
      let forest = state.maps.forest;
      if (layoutChanged) {
        const result = generateForestClearing(settings);
        if (!result.ok) return result;
        forest = result.map;
      } else if (
        (settings.landmark ?? 'None') !== 'None' ||
        (forest.decoration.landmark ?? 'None') !== 'None' ||
        settings.scene === 'Abandoned camp' ||
        forest.decoration.scene === 'Abandoned camp'
      ) {
        forest = changeForestAppearance(forest, settings);
      } else {
        if (settings.density !== forest.decoration.density)
          forest = changeForestDensity(forest, settings.density);
        if (settings.character !== forest.decoration.character)
          forest = changeForestCharacter(forest, settings.character);
      }
      next = forest;
    } else {
      const settings = parsed.settings;
      let dungeon = state.maps.dungeon;
      if (layoutChanged) {
        const result = generateDungeon(settings);
        if (!result.ok) return result;
        dungeon = result.map;
      } else if (
        settings.ritual ||
        dungeon.decoration.ritual ||
        (settings.furniture ?? 'None') !== 'None' ||
        (dungeon.decoration.furniture ?? 'None') !== 'None' ||
        (settings.landmark ?? 'None') !== 'None' ||
        (dungeon.decoration.landmark ?? 'None') !== 'None' ||
        settings.scene === 'Forgotten study' ||
        dungeon.decoration.scene === 'Forgotten study'
      ) {
        dungeon = changeDungeonAppearance(dungeon, settings);
      } else {
        if (settings.density !== dungeon.decoration.density)
          dungeon = changeDensity(dungeon, settings.density);
        if (settings.preset !== dungeon.decoration.preset)
          dungeon = changePreset(dungeon, settings.preset);
      }
      next = dungeon;
    }
    if (
      next.type === 'tower' &&
      parsed.type === 'tower' &&
      next.decoration.laboratoryFloor !== (parsed.settings.laboratoryFloor ?? undefined)
    )
      return {
        ok: false,
        error: 'That laboratory could not fit on that floor. Try another floor or seed.',
      };
    if (next.decoration.density !== parsed.settings.density) {
      return {
        ok: false,
        error: 'Those decoration settings could not be applied. Try another density.',
      };
    }
    if (
      next.type === 'dungeon' &&
      parsed.type === 'dungeon' &&
      next.decoration.preset !== parsed.settings.preset
    ) {
      return {
        ok: false,
        error:
          'Those dungeon settings could not be applied. Try another seed or decoration density.',
      };
    }
    if (
      next.type === 'forest' &&
      parsed.type === 'forest' &&
      next.decoration.character !== parsed.settings.character
    ) {
      return { ok: false, error: 'That forest character could not be applied. Try another seed.' };
    }
    if (
      next.type === 'forest' &&
      parsed.type === 'forest' &&
      (next.decoration.landmark ?? 'None') !== (parsed.settings.landmark ?? 'None')
    )
      return {
        ok: false,
        error: 'That landmark could not fit. Try another seed or remove the camp.',
      };
    if (
      next.type === 'forest' &&
      parsed.type === 'forest' &&
      (next.decoration.scene ?? 'None') !== (parsed.settings.scene ?? 'None')
    ) {
      return { ok: false, error: 'That camp could not fit beside the path. Try another seed.' };
    }
    if (
      next.type === 'dungeon' &&
      parsed.type === 'dungeon' &&
      Boolean(next.decoration.ritual) !== Boolean(parsed.settings.ritual)
    )
      return {
        ok: false,
        error: 'That ritual site could not fit. Try another seed or fewer additions.',
      };
    if (
      next.type === 'dungeon' &&
      parsed.type === 'dungeon' &&
      (next.decoration.furniture ?? 'None') !== (parsed.settings.furniture ?? 'None')
    )
      return {
        ok: false,
        error: 'That table could not fit. Try another seed, density, or fewer features.',
      };
    if (
      next.type === 'dungeon' &&
      parsed.type === 'dungeon' &&
      (next.decoration.landmark ?? 'None') !== (parsed.settings.landmark ?? 'None')
    )
      return {
        ok: false,
        error: 'That statue could not fit. Try another seed or remove the study.',
      };
    if (
      next.type === 'dungeon' &&
      parsed.type === 'dungeon' &&
      (next.decoration.scene ?? 'None') !== (parsed.settings.scene ?? 'None')
    )
      return {
        ok: false,
        error: 'That study could not fit. Try another seed or decoration density.',
      };
    this.accept(next, true);
    return { ok: true, layoutChanged };
  }

  private accept(map: GeneratedMap, resetDraft: boolean): void {
    this.state.update((state) => ({
      ...state,
      comparisons: showCurrent(state.comparisons, map.type),
      maps:
        map.type === 'tower'
          ? { ...state.maps, tower: map }
          : map.type === 'courtyard'
            ? { ...state.maps, courtyard: map }
            : map.type === 'dungeon'
              ? { ...state.maps, dungeon: map }
              : { ...state.maps, forest: map },
      drafts: resetDraft ? draftsForMap(state.drafts, map) : state.drafts,
      histories:
        map.type === 'tower'
          ? {
              ...state.histories,
              tower: resetDraft
                ? { past: [], future: [] }
                : recordShuffle(state.histories.tower, state.maps.tower),
            }
          : map.type === 'courtyard'
            ? {
                ...state.histories,
                courtyard: resetDraft
                  ? { past: [], future: [] }
                  : recordShuffle(state.histories.courtyard, state.maps.courtyard),
              }
            : map.type === 'dungeon'
              ? {
                  ...state.histories,
                  dungeon: resetDraft
                    ? { past: [], future: [] }
                    : recordShuffle(state.histories.dungeon, state.maps.dungeon),
                }
              : {
                  ...state.histories,
                  forest: resetDraft
                    ? { past: [], future: [] }
                    : recordShuffle(state.histories.forest, state.maps.forest),
                },
    }));
  }
}
