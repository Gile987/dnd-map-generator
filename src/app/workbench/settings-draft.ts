import type {
  DecorationPreset,
  Density,
  Dungeon,
  DungeonSettings,
  DungeonScene,
  ForestCharacter,
  ForestClearing,
  ForestSettings,
  ForestScene,
} from '../engine/model';
import { ROOM_MAX, ROOM_MIN } from '../engine/model';
import { validateForestSettings } from '../engine/forest-validation';
import { validateSettings } from '../engine/validation';

interface CommonDraft {
  readonly seed: string;
  readonly density: Density;
}

export interface DungeonDraft extends CommonDraft {
  readonly type: 'dungeon';
  readonly rooms: string;
  readonly preset: DecorationPreset;
  readonly scene?: DungeonScene;
}

export interface ForestDraft extends CommonDraft {
  readonly type: 'forest';
  readonly character: ForestCharacter;
  readonly scene?: ForestScene;
}

export interface SettingsDrafts {
  readonly dungeon: DungeonDraft;
  readonly forest: ForestDraft;
}

export type SettingsDraft = DungeonDraft | ForestDraft;

export type DraftChange =
  | { readonly type: 'dungeon'; readonly changes: Partial<Omit<DungeonDraft, 'type'>> }
  | { readonly type: 'forest'; readonly changes: Partial<Omit<ForestDraft, 'type'>> };

type ParsedDraft =
  | { readonly ok: true; readonly type: 'dungeon'; readonly settings: DungeonSettings }
  | { readonly ok: true; readonly type: 'forest'; readonly settings: ForestSettings }
  | { readonly ok: false; readonly error: string };

export function dungeonDraftForMap(map: Dungeon): DungeonDraft {
  return {
    type: 'dungeon',
    seed: map.seed,
    rooms: String(map.layout.rooms.length),
    density: map.decoration.density,
    preset: map.decoration.preset,
    ...(map.decoration.scene ? { scene: map.decoration.scene } : {}),
  };
}

export function forestDraftForMap(map: ForestClearing): ForestDraft {
  return {
    type: 'forest',
    seed: map.seed,
    density: map.decoration.density,
    character: map.decoration.character,
    ...(map.decoration.scene ? { scene: map.decoration.scene } : {}),
  };
}

export function parseDraft(draft: SettingsDraft): ParsedDraft {
  if (draft.type === 'forest') {
    const settings: ForestSettings = {
      seed: draft.seed,
      density: draft.density,
      character: draft.character,
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
    ...(draft.scene ? { scene: draft.scene } : {}),
  };
  const error =
    validateSettings(settings) ||
    (!/^\d+$/.test(draft.rooms)
      ? `Choose a whole number of rooms from ${ROOM_MIN} to ${ROOM_MAX}.`
      : undefined);
  return error ? { ok: false, error } : { ok: true, type: 'dungeon', settings };
}
