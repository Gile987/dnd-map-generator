import { HEIGHT, WIDTH } from '../engine/model';
import type { GeneratedMap } from '../engine/model';
import { validateDungeon } from '../engine/validation';
import { validateForest } from '../engine/forest-generate';

export const SAVE_FORMAT_VERSION = '1.0.0';
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

const DENSITIES: readonly string[] = ['Sparse', 'Balanced', 'Cluttered'];
const PRESETS: readonly string[] = ['Mosslit', 'Crypt', 'Storehouse', 'Sanctuary'];
const PROP_KINDS: readonly string[] = [
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
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPoint(value: unknown): boolean {
  return isObject(value) && isFiniteNumber(value['x']) && isFiniteNumber(value['y']);
}

function isUnitFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1;
}

function isProp(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isFiniteNumber(value['x']) &&
    isFiniteNumber(value['y']) &&
    typeof value['kind'] === 'string' &&
    PROP_KINDS.includes(value['kind']) &&
    typeof value['blocking'] === 'boolean' &&
    isUnitFraction(value['variation'])
  );
}

function isRoom(value: unknown): boolean {
  return (
    isObject(value) &&
    isNonNegativeInt(value['id']) &&
    isNonNegativeInt(value['x']) &&
    isNonNegativeInt(value['y']) &&
    isNonNegativeInt(value['width']) &&
    isNonNegativeInt(value['height'])
  );
}

function isConnection(value: unknown): boolean {
  return (
    isObject(value) &&
    isNonNegativeInt(value['from']) &&
    isNonNegativeInt(value['to']) &&
    (value['bend'] === 'horizontal' || value['bend'] === 'vertical')
  );
}

function isThreshold(value: unknown): boolean {
  return (
    isObject(value) &&
    isNonNegativeInt(value['x']) &&
    isNonNegativeInt(value['y']) &&
    (value['axis'] === 'horizontal' || value['axis'] === 'vertical') &&
    value['span'] === 2 &&
    isNonNegativeInt(value['roomId'])
  );
}

function isLandmark(value: unknown): boolean {
  return (
    isObject(value) &&
    isNonNegativeInt(value['x']) &&
    isNonNegativeInt(value['y']) &&
    isNonNegativeInt(value['roomId'])
  );
}

function isTileField(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === WIDTH * HEIGHT &&
    value.every((tile) => typeof tile === 'boolean')
  );
}

function isDungeonLayout(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { tiles, rooms, connections, thresholds, entrance, objective } = value;
  return (
    isTileField(tiles) &&
    Array.isArray(rooms) &&
    rooms.every(isRoom) &&
    Array.isArray(connections) &&
    connections.every(isConnection) &&
    Array.isArray(thresholds) &&
    thresholds.every(isThreshold) &&
    isLandmark(entrance) &&
    isLandmark(objective)
  );
}

function isForestLayout(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { tiles, route, pathStart, pathEnd } = value;
  return (
    isTileField(tiles) &&
    Array.isArray(route) &&
    route.every((tile) => isNonNegativeInt(tile) && tile < WIDTH * HEIGHT) &&
    isPoint(pathStart) &&
    isPoint(pathEnd)
  );
}

function isDecorationBase(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { props, density, revision } = value;
  return (
    Array.isArray(props) &&
    props.every(isProp) &&
    typeof density === 'string' &&
    DENSITIES.includes(density) &&
    isNonNegativeInt(revision)
  );
}

function isDungeonDecoration(value: unknown): boolean {
  return (
    isDecorationBase(value) &&
    isObject(value) &&
    typeof value['preset'] === 'string' &&
    PRESETS.includes(value['preset'])
  );
}

function isForestDecoration(value: unknown): boolean {
  return isDecorationBase(value);
}

function isGeneratedMap(value: unknown): value is GeneratedMap {
  if (!isObject(value)) return false;
  const { type, version, seed, surfaceSeed, layout, decoration } = value;
  if (type !== 'dungeon' && type !== 'forest') return false;
  if (typeof version !== 'string' || !version) return false;
  if (typeof seed !== 'string' || !seed.trim() || seed.trim().length > 64) return false;
  if (!isFiniteNumber(surfaceSeed)) return false;
  if (!isObject(layout) || !isObject(decoration)) return false;
  if (type === 'dungeon') return isDungeonLayout(layout) && isDungeonDecoration(decoration);
  return isForestLayout(layout) && isForestDecoration(decoration);
}

function validateMap(map: GeneratedMap): string | undefined {
  return map.type === 'dungeon' ? validateDungeon(map) : validateForest(map);
}

export function isUsableMap(value: unknown): value is GeneratedMap {
  if (!isGeneratedMap(value)) return false;
  try {
    return validateMap(value) === undefined;
  } catch {
    return false;
  }
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
  if (!isUsableMap(map)) return undefined;
  return { id, name, favorite, savedAt, saveFormatVersion, thumbnail, map };
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
  return `${map.decoration.density} r${map.decoration.revision}`;
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
