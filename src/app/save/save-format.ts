import type { GeneratedMap } from '../engine/model';
import { parseSavedMapBody } from './map-schema';
import type { SaveVocabulary } from './map-schema';

export const SAVE_FORMAT_VERSION = '2.0.0';
export const SAVE_STORAGE_KEY = 'encounter-map-forge.saves';
export const BACKUP_FORMAT = 'encounter-map-forge-saves';
export const NAME_MAX = 64;

export interface SavedMap {
  readonly id: string;
  readonly name: string;
  readonly favorite: boolean;
  readonly savedAt: string;
  readonly saveFormatVersion: string;
  readonly thumbnail: string;
  readonly map: GeneratedMap;
}

export interface SaveBundle {
  readonly format: typeof BACKUP_FORMAT;
  readonly saveFormatVersion: string;
  readonly exportedAt: string;
  readonly maps: readonly SavedMap[];
}

export type ParseResult =
  | { readonly ok: true; readonly maps: readonly SavedMap[]; readonly skipped: number }
  | { readonly ok: false; readonly error: string };

const FORMAT_2_VOCABULARY: SaveVocabulary = {
  mapTypes: ['dungeon', 'forest'],
  densities: ['Sparse', 'Balanced', 'Cluttered'],
  presets: ['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary'],
  forestCharacters: ['Verdant', 'Autumn', 'Pines', 'Fey'],
  propKinds: [
    'crate',
    'barrel',
    'rubble',
    'rug',
    'sconce',
    'moss',
    'sarcophagus',
    'vine',
    'broken_column',
    'tree',
    'boulder',
    'fern',
    'mushroom',
    'bush',
    'log',
    'stump',
    'flower',
  ],
};

const FORMAT_1_VOCABULARY: SaveVocabulary = {
  mapTypes: ['dungeon', 'forest'],
  densities: ['Sparse', 'Balanced', 'Cluttered'],
  presets: ['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary'],
  forestCharacters: ['Verdant', 'Autumn', 'Pines', 'Fey'],
  propKinds: [
    'crate',
    'barrel',
    'rubble',
    'rug',
    'sconce',
    'moss',
    'sarcophagus',
    'vine',
    'broken_column',
    'tree',
    'boulder',
    'fern',
    'mushroom',
    'bush',
    'log',
    'stump',
    'flower',
  ],
};

export function saveVocabulary(version: string): SaveVocabulary | undefined {
  const parsed = parseVersion(version);
  if (!parsed || parsed.length !== 3) return undefined;
  if (parsed[0] === 1 && parsed[1] === 0 && parsed[2] === 0) return FORMAT_1_VOCABULARY;
  if (parsed[0] === 2 && parsed[1] === 0 && parsed[2] === 0) return FORMAT_2_VOCABULARY;
  return undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseVersion(version: string): readonly number[] | undefined {
  const parts = version.split('.');
  if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) return undefined;
  return parts.map(Number);
}

function isSupportedVersion(version: unknown): boolean {
  if (typeof version !== 'string') return false;
  const candidate = parseVersion(version);
  const current = parseVersion(SAVE_FORMAT_VERSION);
  if (!candidate || !current) return false;
  const length = Math.max(candidate.length, current.length);
  for (let i = 0; i < length; i++) {
    const a = candidate[i] ?? 0;
    const b = current[i] ?? 0;
    if (a !== b) return a <= b;
  }
  return true;
}

export function parseSavedMap(value: unknown): SavedMap | undefined {
  if (!isObject(value)) return undefined;
  const { id, name, favorite, savedAt, saveFormatVersion, thumbnail, map } = value;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) return undefined;
  if (typeof name !== 'string' || !name.trim() || name.length > NAME_MAX) return undefined;
  if (typeof favorite !== 'boolean') return undefined;
  if (typeof savedAt !== 'string') return undefined;
  if (typeof saveFormatVersion !== 'string' || !isSupportedVersion(saveFormatVersion))
    return undefined;
  if (typeof thumbnail !== 'string' || !thumbnail.startsWith('data:image/')) return undefined;
  const vocabulary = saveVocabulary(saveFormatVersion);
  if (!vocabulary) return undefined;
  const normalizedMap = parseSavedMapBody(map, vocabulary);
  if (!normalizedMap) return undefined;
  return {
    id,
    name,
    favorite,
    savedAt,
    saveFormatVersion: SAVE_FORMAT_VERSION,
    thumbnail,
    map: normalizedMap,
  };
}

export function parseBundle(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That backup is not valid JSON.' };
  }
  if (!isObject(data)) return { ok: false, error: 'That backup is not a valid map library.' };
  if (data['format'] !== BACKUP_FORMAT) {
    return { ok: false, error: 'That file is not an Encounter Map Forge backup.' };
  }
  if (!isSupportedVersion(data['saveFormatVersion'])) {
    return {
      ok: false,
      error: 'That backup uses a save format this version of Encounter Map Forge cannot read.',
    };
  }
  const raw = data['maps'];
  if (!Array.isArray(raw)) return { ok: false, error: 'That backup is not a valid map library.' };
  const maps: SavedMap[] = [];
  let skipped = 0;
  for (const entry of raw) {
    const record = parseSavedMap(entry);
    if (record) maps.push(record);
    else skipped++;
  }
  if (maps.length === 0) {
    return {
      ok: false,
      error:
        skipped > 0
          ? 'None of the maps in that backup could be read. They may use a newer save format.'
          : 'That backup does not contain any maps.',
    };
  }
  return { ok: true, maps, skipped };
}

export function serializeBundle(maps: readonly SavedMap[]): string {
  const bundle: SaveBundle = {
    format: BACKUP_FORMAT,
    saveFormatVersion: SAVE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    maps,
  };
  return JSON.stringify(bundle, null, 2);
}

export function normalizeName(name: string): string {
  return name.trim().slice(0, NAME_MAX);
}

export function duplicateName(name: string): string {
  const suffix = ' (copy)';
  return `${name.slice(0, NAME_MAX - suffix.length)}${suffix}`;
}

export function defaultMapName(map: GeneratedMap): string {
  const suffix = map.type === 'dungeon' ? ' dungeon' : ' clearing';
  return `${map.seed.slice(0, NAME_MAX - suffix.length)}${suffix}`;
}

export function makeSavedMap(
  map: GeneratedMap,
  name: string,
  thumbnail: string,
  id: string,
  savedAt: string,
): SavedMap {
  const finalName = normalizeName(name) || defaultMapName(map);
  return {
    id,
    name: finalName,
    favorite: false,
    savedAt,
    saveFormatVersion: SAVE_FORMAT_VERSION,
    thumbnail,
    map,
  };
}

export function mapSummary(map: GeneratedMap): string {
  if (map.type === 'dungeon') {
    return `${map.layout.rooms.length} rooms · ${map.decoration.preset} · ${map.decoration.density} r${map.decoration.revision}`;
  }
  return `${map.decoration.character} · ${map.decoration.density} r${map.decoration.revision}`;
}

export function uniqueById(
  maps: readonly SavedMap[],
  existingIds: ReadonlySet<string>,
): { fresh: SavedMap[]; skipped: number } {
  const seen = new Set(existingIds);
  const fresh: SavedMap[] = [];
  let skipped = 0;
  for (const record of maps) {
    if (seen.has(record.id)) {
      skipped++;
      continue;
    }
    seen.add(record.id);
    fresh.push(record);
  }
  return { fresh, skipped };
}
