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
import { DEFAULT_FOREST_CHARACTER, DEFAULT_PRESET } from '../engine/model';
import type { Dungeon, ForestClearing, GeneratedMap, MapType } from '../engine/model';
import { dungeonDraftForMap, forestDraftForMap, parseDraft } from './settings-draft';
import type { DraftChange, SettingsDrafts } from './settings-draft';

interface SessionState {
  readonly type: MapType;
  readonly maps: { readonly dungeon: Dungeon; readonly forest: ForestClearing };
  readonly drafts: SettingsDrafts;
}

export type ApplySettingsResult =
  | { readonly ok: true; readonly layoutChanged: boolean }
  | { readonly ok: false; readonly error: string };

function draftsForMap(drafts: SettingsDrafts, map: GeneratedMap): SettingsDrafts {
  return map.type === 'dungeon'
    ? { ...drafts, dungeon: dungeonDraftForMap(map) }
    : { ...drafts, forest: forestDraftForMap(map) };
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
    drafts: { dungeon: dungeonDraftForMap(dungeon.map), forest: forestDraftForMap(forest.map) },
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
    const state = this.state();
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
      (draft.landmark ?? 'None') !== (decoration.landmark ?? 'None') ||
      (draft.scene ?? 'None') !== (decoration.scene ?? 'None')
    );
  });
  private readonly parsedDraft = computed(() => parseDraft(this.draft()));
  readonly validationError = computed(() => {
    const result = this.parsedDraft();
    return result.ok ? undefined : result.error;
  });

  selectMapType(type: MapType): void {
    this.state.update((state) => (state.type === type ? state : { ...state, type }));
  }

  updateDraft(change: DraftChange): void {
    this.state.update((state) => {
      if (change.type !== state.type) return state;
      const drafts =
        change.type === 'dungeon'
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
      type: map.type,
      maps:
        map.type === 'dungeon' ? { ...state.maps, dungeon: map } : { ...state.maps, forest: map },
      drafts: draftsForMap(state.drafts, map),
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
    const parsed = this.parsedDraft();
    if (!parsed.ok) return parsed;
    const state = this.state();
    const layoutChanged = this.layoutPending();
    let next: GeneratedMap;
    if (parsed.type === 'forest') {
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
      maps:
        map.type === 'dungeon' ? { ...state.maps, dungeon: map } : { ...state.maps, forest: map },
      drafts: resetDraft ? draftsForMap(state.drafts, map) : state.drafts,
    }));
  }
}
