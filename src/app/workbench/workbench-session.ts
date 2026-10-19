import { Injectable, computed, signal } from '@angular/core';
import { changeDensity, changePreset, shuffleDetails } from '../engine/decoration';
import {
  changeForestCharacter,
  changeForestDensity,
  generateForestClearing,
  shuffleForestDetails,
  validateForestSettings,
} from '../engine/forest-generate';
import { generateDungeon } from '../engine/generate';
import { DEFAULT_FOREST_CHARACTER, DEFAULT_PRESET } from '../engine/model';
import type {
  DecorationPreset,
  Density,
  Dungeon,
  DungeonSettings,
  ForestCharacter,
  ForestClearing,
  ForestSettings,
  GeneratedMap,
  MapType,
} from '../engine/model';
import { validateSettings } from '../engine/validation';
import { ROOM_DEFAULT } from '../room-count';

export interface SettingsDraft {
  readonly seed: string;
  readonly rooms: string;
  readonly density: Density;
  readonly preset: DecorationPreset;
  readonly character: ForestCharacter;
}

interface SessionState {
  readonly type: MapType;
  readonly maps: { readonly dungeon: Dungeon; readonly forest: ForestClearing };
  readonly drafts: Readonly<Record<MapType, SettingsDraft>>;
}

export type ApplySettingsResult =
  | { readonly ok: true; readonly layoutChanged: boolean }
  | { readonly ok: false; readonly error: string };

function draftForMap(map: GeneratedMap): SettingsDraft {
  return {
    seed: map.seed,
    rooms: map.type === 'dungeon' ? String(map.layout.rooms.length) : ROOM_DEFAULT,
    density: map.decoration.density,
    preset: map.type === 'dungeon' ? map.decoration.preset : DEFAULT_PRESET,
    character: map.type === 'forest' ? map.decoration.character : DEFAULT_FOREST_CHARACTER,
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
  return {
    type: 'dungeon',
    maps: { dungeon: dungeon.map, forest: forest.map },
    drafts: { dungeon: draftForMap(dungeon.map), forest: draftForMap(forest.map) },
  };
}

function settingsForDraft(draft: SettingsDraft): DungeonSettings & ForestSettings {
  return {
    seed: draft.seed,
    roomCount: Number(draft.rooms),
    density: draft.density,
    preset: draft.preset,
    character: draft.character,
  };
}

@Injectable()
export class WorkbenchSession {
  private readonly state = signal<SessionState>(initialState());
  readonly mapType = computed(() => this.state().type);
  readonly map = computed(() => {
    const state = this.state();
    return state.maps[state.type];
  });
  readonly draft = computed(() => {
    const state = this.state();
    return state.drafts[state.type];
  });
  private readonly layoutPending = computed(() => {
    const map = this.map();
    const draft = this.draft();
    return (
      draft.seed.trim() !== map.seed ||
      (map.type === 'dungeon' &&
        (!/^\d+$/.test(draft.rooms) || Number(draft.rooms) !== map.layout.rooms.length))
    );
  });
  readonly pending = computed(() => {
    const map = this.map();
    const draft = this.draft();
    return (
      this.layoutPending() ||
      draft.density !== map.decoration.density ||
      (map.type === 'dungeon' && draft.preset !== map.decoration.preset) ||
      (map.type === 'forest' && draft.character !== map.decoration.character)
    );
  });
  readonly validationError = computed(() => {
    const draft = this.draft();
    const settings = settingsForDraft(draft);
    return this.mapType() === 'forest'
      ? validateForestSettings(settings)
      : validateSettings(settings) ||
          (!/^\d+$/.test(draft.rooms) ? 'Choose a whole number of rooms from 4 to 8.' : undefined);
  });

  selectMapType(type: MapType): void {
    this.state.update((state) => (state.type === type ? state : { ...state, type }));
  }

  updateDraft(changes: Partial<SettingsDraft>): void {
    this.state.update((state) => ({
      ...state,
      drafts: {
        ...state.drafts,
        [state.type]: { ...state.drafts[state.type], ...changes },
      },
    }));
  }

  resetChanges(): void {
    this.state.update((state) => ({
      ...state,
      drafts: { ...state.drafts, [state.type]: draftForMap(state.maps[state.type]) },
    }));
  }

  openSaved(map: GeneratedMap): void {
    this.state.update((state) => ({
      type: map.type,
      maps:
        map.type === 'dungeon' ? { ...state.maps, dungeon: map } : { ...state.maps, forest: map },
      drafts: { ...state.drafts, [map.type]: draftForMap(map) },
    }));
  }

  shuffle(): void {
    const current = this.map();
    this.accept(
      current.type === 'dungeon' ? shuffleDetails(current) : shuffleForestDetails(current),
      false,
    );
  }

  generate(): ApplySettingsResult {
    if (!this.pending()) return { ok: true, layoutChanged: false };
    const error = this.validationError();
    if (error) return { ok: false, error };
    const current = this.map();
    const draft = this.draft();
    const layoutChanged = this.layoutPending();
    let next: GeneratedMap;
    if (layoutChanged) {
      const settings = settingsForDraft(draft);
      const result =
        current.type === 'dungeon' ? generateDungeon(settings) : generateForestClearing(settings);
      if (!result.ok) return result;
      next = result.map;
    } else if (current.type === 'forest') {
      next = current;
      if (draft.density !== next.decoration.density)
        next = changeForestDensity(next, draft.density);
      if (draft.character !== next.decoration.character)
        next = changeForestCharacter(next, draft.character);
    } else {
      next = current;
      if (draft.density !== current.decoration.density) next = changeDensity(next, draft.density);
      if (draft.preset !== current.decoration.preset) next = changePreset(next, draft.preset);
    }
    if (next.decoration.density !== draft.density) {
      return {
        ok: false,
        error: 'Those decoration settings could not be applied. Try another density.',
      };
    }
    if (next.type === 'forest' && next.decoration.character !== draft.character) {
      return { ok: false, error: 'That forest character could not be applied. Try another seed.' };
    }
    this.accept(next, true);
    return { ok: true, layoutChanged };
  }

  private accept(map: GeneratedMap, resetDraft: boolean): void {
    this.state.update((state) => ({
      ...state,
      maps:
        map.type === 'dungeon' ? { ...state.maps, dungeon: map } : { ...state.maps, forest: map },
      drafts: resetDraft ? { ...state.drafts, [map.type]: draftForMap(map) } : state.drafts,
    }));
  }
}
