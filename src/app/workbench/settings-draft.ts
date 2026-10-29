import type { Tower, TowerSettings, TowerStairStyle } from '../engine/tower';
import { validateTowerSettings, towerStairStyle } from '../engine/tower';
import type {
  DecorationPreset,
  Density,
  Dungeon,
  DungeonSettings,
  DungeonScene,
  DungeonLandmark,
  DungeonFurniture,
  ForestCharacter,
  ForestClearing,
  ForestSettings,
  ForestScene,
  ForestLandmark,
  CourtyardSettings,
  RuinedCourtyard,
} from '../engine/model';
import { ROOM_MAX, ROOM_MIN } from '../engine/model';
import { validateForestSettings } from '../engine/forest-validation';
import { validateSettings } from '../engine/validation';
import { validateCourtyardSettings } from '../engine/courtyard-validation';

interface CommonDraft {
  readonly seed: string;
  readonly density: Density;
}

export interface DungeonDraft extends CommonDraft {
  readonly ritual?: boolean;
  readonly type: 'dungeon';
  readonly rooms: string;
  readonly preset: DecorationPreset;
  readonly scene?: DungeonScene;
  readonly landmark?: DungeonLandmark;
  readonly furniture?: DungeonFurniture;
}

export interface ForestDraft extends CommonDraft {
  readonly type: 'forest';
  readonly character: ForestCharacter;
  readonly scene?: ForestScene;
  readonly landmark?: ForestLandmark;
}

export interface SettingsDrafts {
  readonly dungeon: DungeonDraft;
  readonly forest: ForestDraft;
  readonly courtyard: CourtyardDraft;
  readonly tower: TowerDraft;
}

export interface CourtyardDraft extends CommonDraft {
  readonly type: 'courtyard';
  readonly fountain: boolean;
}

export interface TowerDraft extends CommonDraft {
  readonly type: 'tower';
  readonly stairStyle?: TowerStairStyle;
  readonly floors: string;
  readonly portalFloor: string;
}
export function towerDraftForMap(map: Tower): TowerDraft {
  return {
    type: 'tower',
    stairStyle: towerStairStyle(map),
    seed: map.seed,
    density: map.decoration.density,
    floors: String(map.layout.floors.length),
    portalFloor: map.layout.portalFloor === null ? 'none' : String(map.layout.portalFloor),
  };
}
export type SettingsDraft = DungeonDraft | ForestDraft | CourtyardDraft | TowerDraft;

export type DraftChange =
  | { readonly type: 'tower'; readonly changes: Partial<Omit<TowerDraft, 'type'>> }
  | { readonly type: 'dungeon'; readonly changes: Partial<Omit<DungeonDraft, 'type'>> }
  | { readonly type: 'forest'; readonly changes: Partial<Omit<ForestDraft, 'type'>> }
  | { readonly type: 'courtyard'; readonly changes: Partial<Omit<CourtyardDraft, 'type'>> };

type ParsedDraft =
  | { readonly ok: true; readonly type: 'tower'; readonly settings: TowerSettings }
  | { readonly ok: true; readonly type: 'dungeon'; readonly settings: DungeonSettings }
  | { readonly ok: true; readonly type: 'forest'; readonly settings: ForestSettings }
  | { readonly ok: true; readonly type: 'courtyard'; readonly settings: CourtyardSettings }
  | { readonly ok: false; readonly error: string };

export function dungeonDraftForMap(map: Dungeon): DungeonDraft {
  return {
    type: 'dungeon',
    seed: map.seed,
    rooms: String(map.layout.rooms.length),
    density: map.decoration.density,
    preset: map.decoration.preset,
    ...(map.decoration.ritual !== undefined ? { ritual: map.decoration.ritual } : {}),
    ...(map.decoration.furniture ? { furniture: map.decoration.furniture } : {}),
    ...(map.decoration.landmark ? { landmark: map.decoration.landmark } : {}),
    ...(map.decoration.scene ? { scene: map.decoration.scene } : {}),
  };
}

export function forestDraftForMap(map: ForestClearing): ForestDraft {
  return {
    type: 'forest',
    seed: map.seed,
    density: map.decoration.density,
    character: map.decoration.character,
    ...(map.decoration.landmark ? { landmark: map.decoration.landmark } : {}),
    ...(map.decoration.scene ? { scene: map.decoration.scene } : {}),
  };
}

export function parseDraft(draft: SettingsDraft): ParsedDraft {
  if (draft.type === 'tower') {
    const settings: TowerSettings = {
      seed: draft.seed,
      density: draft.density,
      stairStyle: draft.stairStyle,
      floorCount: /^\d+$/.test(draft.floors) ? Number(draft.floors) : NaN,
      portalFloor:
        draft.portalFloor === 'none'
          ? null
          : /^\d+$/.test(draft.portalFloor)
            ? Number(draft.portalFloor)
            : NaN,
    };
    const error = validateTowerSettings(settings);
    return error ? { ok: false, error } : { ok: true, type: 'tower', settings };
  }
  if (draft.type === 'courtyard') {
    const settings: CourtyardSettings = {
      seed: draft.seed,
      density: draft.density,
      fountain: draft.fountain,
    };
    const error = validateCourtyardSettings(settings);
    return error ? { ok: false, error } : { ok: true, type: 'courtyard', settings };
  }
  if (draft.type === 'forest') {
    const settings: ForestSettings = {
      seed: draft.seed,
      density: draft.density,
      character: draft.character,
      ...(draft.landmark ? { landmark: draft.landmark } : {}),
      ...(draft.scene ? { scene: draft.scene } : {}),
    };
    const error = validateForestSettings(settings);
    return error ? { ok: false, error } : { ok: true, type: 'forest', settings };
  }
  const settings: DungeonSettings = {
    seed: draft.seed,
    roomCount: Number(draft.rooms),
    density: draft.density,
    preset: draft.preset,
    ...(draft.ritual !== undefined ? { ritual: draft.ritual } : {}),
    ...(draft.furniture ? { furniture: draft.furniture } : {}),
    ...(draft.landmark ? { landmark: draft.landmark } : {}),
    ...(draft.scene ? { scene: draft.scene } : {}),
  };
  const error =
    validateSettings(settings) ||
    (!/^\d+$/.test(draft.rooms)
      ? `Choose a whole number of rooms from ${ROOM_MIN} to ${ROOM_MAX}.`
      : undefined);
  return error ? { ok: false, error } : { ok: true, type: 'dungeon', settings };
}

export function courtyardDraftForMap(map: RuinedCourtyard): CourtyardDraft {
  return {
    type: 'courtyard',
    seed: map.seed,
    density: map.decoration.density,
    fountain: map.decoration.fountain,
  };
}
