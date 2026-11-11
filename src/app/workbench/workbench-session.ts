import { towerBase } from '../engine/object-editor/tower-document';
import type { TowerDocument } from '../engine/object-editor/tower-document';
import { forestBase } from '../engine/object-editor/forest-document';
import type { ForestDocument } from '../engine/object-editor/forest-document';
import { isEditableMap } from '../engine/object-editor/editor-view';
import { courtyardBase } from '../engine/object-editor/courtyard-document';
import type { CourtyardDocument } from '../engine/object-editor/courtyard-document';
import { applyEditorCommand } from '../engine/object-editor/editor-commands';
import type { MapEditResult } from '../engine/object-editor/editor-commands';
import { toggleDungeonDoor, withDoorStates } from '../engine/dungeon-doors';
import type { ObjectCommand, EditResult } from '../engine/object-editor/commands';
import { dungeonBase } from '../engine/object-editor/document';
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
import {
  DEFAULT_COURTYARD_CHARACTER,
  DEFAULT_FOREST_CHARACTER,
  DEFAULT_PRESET,
} from '../engine/model';
import type { DungeonDocument, MapDocument, MapType } from '../engine/model';
import {
  towerDraftForMap,
  dungeonDraftForMap,
  forestDraftForMap,
  courtyardDraftForMap,
  parseDraft,
} from './settings-draft';
import type { DraftChange, SettingsDrafts } from './settings-draft';

const SHUFFLE_HISTORY_LIMIT = 20;

interface ShuffleHistory<T extends MapDocument> {
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
  readonly pinned?: MapDocument;
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
    readonly dungeon: DungeonDocument;
    readonly forest: ForestDocument;
    readonly courtyard: CourtyardDocument;
    readonly tower: TowerDocument;
  };
  readonly drafts: SettingsDrafts;
  readonly histories: {
    readonly dungeon: ShuffleHistory<DungeonDocument>;
    readonly forest: ShuffleHistory<ForestDocument>;
    readonly courtyard: ShuffleHistory<CourtyardDocument>;
    readonly tower: ShuffleHistory<TowerDocument>;
  };
}

export type ApplySettingsResult =
  | { readonly ok: true; readonly layoutChanged: boolean }
  | { readonly ok: false; readonly error: string };

function draftsForMap(drafts: SettingsDrafts, map: MapDocument): SettingsDrafts {
  if (map.type === 'tower') return { ...drafts, tower: towerDraftForMap(map) };
  if (map.type === 'courtyard') return { ...drafts, courtyard: courtyardDraftForMap(map) };
  return map.type === 'dungeon'
    ? { ...drafts, dungeon: dungeonDraftForMap(map) }
    : { ...drafts, forest: forestDraftForMap(map) };
}

function recordShuffle<T extends MapDocument>(
  history: ShuffleHistory<T>,
  current: T,
): ShuffleHistory<T> {
  return { past: [...history.past, current].slice(-SHUFFLE_HISTORY_LIMIT), future: [] };
}

function moveShuffle<T extends MapDocument>(
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
  const courtyard = generateCourtyard({
    seed: 'ivy-court',
    density: 'Balanced',
    character: DEFAULT_COURTYARD_CHARACTER,
    fountain: false,
  });
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
            : NaN) !== (decoration.laboratoryFloor ?? null) ||
        (draft.observatoryFloor === 'none'
          ? null
          : /^\d+$/.test(draft.observatoryFloor)
            ? Number(draft.observatoryFloor)
            : NaN) !== (decoration.observatoryFloor ?? null)
      );
    }
    if (state.type === 'courtyard') {
      const draft = state.drafts.courtyard;
      const decoration = state.maps.courtyard.decoration;
      return (
        this.layoutPending() ||
        draft.density !== decoration.density ||
        draft.character !== decoration.character ||
        draft.fountain !== decoration.fountain ||
        Boolean(draft.brazier) !== Boolean(decoration.brazier) ||
        Boolean(draft.wagon) !== Boolean(decoration.wagon) ||
        Boolean(draft.well) !== Boolean(decoration.well)
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
        (draft.scene ?? 'None') !== (decoration.scene ?? 'None') ||
        Boolean(draft.fallenTree) !== Boolean(decoration.fallenTree)
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

  openSaved(map: MapDocument): void {
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

  editObjects(source: MapDocument, command: ObjectCommand): MapEditResult {
    const current = this.currentMap();
    if (!isEditableMap(current) || current !== source || this.comparison().selected !== 'current')
      return { ok: false, error: 'The displayed map changed. Select the object again.' };
    const result = applyEditorCommand(current, command);
    if (result.ok && result.document !== current) this.accept(result.document, false);
    return result;
  }

  toggleDoor(source: MapDocument, id: string): EditResult {
    const current = this.currentMap();
    if (
      current.type !== 'dungeon' ||
      current !== source ||
      this.comparison().selected !== 'current'
    )
      return { ok: false, error: 'The displayed map changed. Choose the door again.' };
    const result = toggleDungeonDoor(current, id);
    if (result.ok) this.accept(result.document, false);
    return result;
  }

  shuffle(): boolean {
    const current = this.currentMap();
    if (isEditableMap(current) && current.objectEdits) return false;
    const next =
      current.type === 'tower'
        ? shuffleTowerDetails(towerBase(current))
        : current.type === 'courtyard'
          ? shuffleCourtyardDetails(courtyardBase(current))
          : current.type === 'dungeon'
            ? withDoorStates(shuffleDetails(dungeonBase(current)), current.doorStates)
            : shuffleForestDetails(forestBase(current));
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

  generate(replaceCustomizations = false): ApplySettingsResult {
    const current = this.currentMap();
    if (!this.pending()) return { ok: true, layoutChanged: false };
    if (isEditableMap(current) && current.objectEdits && !replaceCustomizations)
      return {
        ok: false,
        error:
          'Choose Replace customizations and generate to replace this arrangement. Undo can restore it.',
      };
    const parsed = this.parsedDraft();
    if (!parsed.ok) return parsed;
    const state = this.state();
    const layoutChanged = this.layoutPending();
    let next: MapDocument;
    if (parsed.type === 'tower') {
      if (layoutChanged) {
        const result = generateTower(parsed.settings);
        if (!result.ok) return result;
        next = result.map;
      } else next = changeTowerAppearance(towerBase(state.maps.tower), parsed.settings);
    } else if (parsed.type === 'courtyard') {
      if (layoutChanged) {
        const result = generateCourtyard(parsed.settings);
        if (!result.ok) return result;
        next = result.map;
      } else {
        next = changeCourtyardAppearance(courtyardBase(state.maps.courtyard), parsed.settings);
      }
      if (
        next.decoration.fountain !== parsed.settings.fountain ||
        Boolean(next.decoration.brazier) !== Boolean(parsed.settings.brazier) ||
        Boolean(next.decoration.wagon) !== Boolean(parsed.settings.wagon) ||
        Boolean(next.decoration.well) !== Boolean(parsed.settings.well) ||
        next.decoration.density !== parsed.settings.density
      )
        return {
          ok: false,
          error: 'Those courtyard additions could not fit. Try another seed or remove an addition.',
        };
    } else if (parsed.type === 'forest') {
      const settings = parsed.settings;
      let forest = forestBase(state.maps.forest);
      if (layoutChanged) {
        const result = generateForestClearing(settings);
        if (!result.ok) return result;
        forest = result.map;
      } else if (
        (settings.landmark ?? 'None') !== 'None' ||
        (forest.decoration.landmark ?? 'None') !== 'None' ||
        settings.fallenTree ||
        forest.decoration.fallenTree ||
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
      let dungeon = dungeonBase(state.maps.dungeon);
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
      next = layoutChanged ? dungeon : withDoorStates(dungeon, state.maps.dungeon.doorStates);
    }
    if (
      next.type === 'tower' &&
      parsed.type === 'tower' &&
      next.decoration.observatoryFloor !== (parsed.settings.observatoryFloor ?? undefined)
    )
      return {
        ok: false,
        error: 'Those tower additions could not fit. Try another floor or seed.',
      };
    if (
      next.type === 'tower' &&
      parsed.type === 'tower' &&
      next.decoration.laboratoryFloor !== (parsed.settings.laboratoryFloor ?? undefined)
    )
      return {
        ok: false,
        error: 'That laboratory could not fit on that floor. Try another floor or seed.',
      };
    if (
      next.type === 'forest' &&
      parsed.type === 'forest' &&
      Boolean(next.decoration.fallenTree) !== Boolean(parsed.settings.fallenTree)
    )
      return {
        ok: false,
        error: 'That fallen ancient tree could not fit. Try another seed or remove an addition.',
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
      next.type === 'courtyard' &&
      parsed.type === 'courtyard' &&
      next.decoration.character !== parsed.settings.character
    ) {
      return {
        ok: false,
        error: 'That courtyard character could not be applied. Try another seed.',
      };
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
    const preserveHistory =
      (isEditableMap(current) && !!current.objectEdits) ||
      (current.type === 'dungeon' && !!current.doorStates);
    this.accept(next, true, preserveHistory);
    return { ok: true, layoutChanged };
  }

  private accept(map: MapDocument, resetDraft: boolean, preserveHistory = false): void {
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
              tower:
                resetDraft && !preserveHistory
                  ? { past: [], future: [] }
                  : recordShuffle(state.histories.tower, state.maps.tower),
            }
          : map.type === 'courtyard'
            ? {
                ...state.histories,
                courtyard:
                  resetDraft && !preserveHistory
                    ? { past: [], future: [] }
                    : recordShuffle(state.histories.courtyard, state.maps.courtyard),
              }
            : map.type === 'dungeon'
              ? {
                  ...state.histories,
                  dungeon:
                    resetDraft && !preserveHistory
                      ? { past: [], future: [] }
                      : recordShuffle(state.histories.dungeon, state.maps.dungeon),
                }
              : {
                  ...state.histories,
                  forest:
                    resetDraft && !preserveHistory
                      ? { past: [], future: [] }
                      : recordShuffle(state.histories.forest, state.maps.forest),
                },
    }));
  }
}
