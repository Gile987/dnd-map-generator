import {
  ALL_DENSITIES,
  ALL_DUNGEON_SCENES,
  ALL_DUNGEON_FURNITURE,
  ALL_DUNGEON_LANDMARKS,
  ALL_FOREST_CHARACTERS,
  ALL_FOREST_SCENES,
  ALL_FOREST_LANDMARKS,
  ALL_PRESETS,
  ALL_PROP_KINDS,
  DEFAULT_FOREST_CHARACTER,
  HEIGHT,
  ROOM_MAX,
  ROOM_MIN,
  WIDTH,
  isTilePosition,
} from '../engine/model';
import type { GeneratedMap } from '../engine/model';
import { validateDungeon } from '../engine/validation';
import { validateForest } from '../engine/forest-validation';
import { validateCourtyard } from '../engine/courtyard-validation';
import { isDetailRevision } from '../engine/decoration-revision';

export interface SaveVocabulary {
  readonly forestSurfaces?: readonly number[];
  readonly mapTypes: readonly string[];
  readonly densities: readonly string[];
  readonly presets: readonly string[];
  readonly forestCharacters: readonly string[];
  readonly forestLandmarks?: readonly string[];
  readonly forestScenes?: readonly string[];
  readonly dungeonFurniture?: readonly string[];
  readonly propFootprints?: Readonly<
    Record<
      string,
      { readonly width: number; readonly height: number; readonly rotations: readonly number[] }
    >
  >;
  readonly dungeonLandmarks?: readonly string[];
  readonly dungeonRituals?: readonly boolean[];
  readonly dungeonScenes?: readonly string[];
  readonly studySurfaces?: readonly number[];
  readonly courtyardFountains?: readonly boolean[];
  readonly propKinds: readonly string[];
}

export function mapUsesVocabulary(map: unknown, vocabulary: SaveVocabulary): boolean {
  if (!isObject(map) || !isObject(map['decoration'])) return false;
  const decoration = map['decoration'];
  const type = map['type'];
  if (typeof type !== 'string' || !vocabulary.mapTypes.includes(type)) return false;
  if (
    decoration['forestSurface'] !== undefined &&
    (type !== 'forest' ||
      typeof decoration['forestSurface'] !== 'number' ||
      !vocabulary.forestSurfaces?.includes(decoration['forestSurface']))
  )
    return false;
  if (
    decoration['ritual'] !== undefined &&
    (type !== 'dungeon' ||
      typeof decoration['ritual'] !== 'boolean' ||
      !vocabulary.dungeonRituals?.includes(decoration['ritual']))
  )
    return false;
  if (
    decoration['studySurface'] !== undefined &&
    (type !== 'dungeon' ||
      decoration['scene'] !== 'Forgotten study' ||
      typeof decoration['studySurface'] !== 'number' ||
      !vocabulary.studySurfaces?.includes(decoration['studySurface']))
  )
    return false;
  if (
    typeof decoration['density'] !== 'string' ||
    !vocabulary.densities.includes(decoration['density'])
  )
    return false;
  if (type === 'dungeon') {
    if (
      decoration['furniture'] !== undefined &&
      (typeof decoration['furniture'] !== 'string' ||
        !vocabulary.dungeonFurniture?.includes(decoration['furniture']))
    )
      return false;
    if (
      decoration['landmark'] !== undefined &&
      (typeof decoration['landmark'] !== 'string' ||
        !vocabulary.dungeonLandmarks?.includes(decoration['landmark']))
    )
      return false;
    if (
      decoration['scene'] !== undefined &&
      (typeof decoration['scene'] !== 'string' ||
        !vocabulary.dungeonScenes?.includes(decoration['scene']))
    )
      return false;
    if (
      typeof decoration['preset'] !== 'string' ||
      !vocabulary.presets.includes(decoration['preset'])
    )
      return false;
  }
  if (type === 'forest') {
    if (
      decoration['landmark'] !== undefined &&
      (typeof decoration['landmark'] !== 'string' ||
        !vocabulary.forestLandmarks?.includes(decoration['landmark']))
    )
      return false;
    if (
      decoration['scene'] !== undefined &&
      (typeof decoration['scene'] !== 'string' ||
        !vocabulary.forestScenes?.includes(decoration['scene']))
    )
      return false;
    if (
      typeof decoration['character'] !== 'string' ||
      !vocabulary.forestCharacters.includes(decoration['character'])
    )
      return false;
  }
  if (
    type === 'courtyard' &&
    (typeof decoration['fountain'] !== 'boolean' ||
      !vocabulary.courtyardFountains?.includes(decoration['fountain']))
  )
    return false;
  if (Array.isArray(decoration['props'])) {
    for (const prop of decoration['props']) {
      if (
        !isObject(prop) ||
        typeof prop['kind'] !== 'string' ||
        !vocabulary.propKinds.includes(prop['kind'])
      )
        return false;
      if (prop['footprint'] !== undefined || prop['rotation'] !== undefined) {
        const spec = vocabulary.propFootprints?.[prop['kind']];
        const footprint = prop['footprint'];
        if (
          !spec ||
          !isObject(footprint) ||
          footprint['width'] !== spec.width ||
          footprint['height'] !== spec.height ||
          typeof prop['rotation'] !== 'number' ||
          !spec.rotations.includes(prop['rotation'])
        )
          return false;
      }
    }
  }
  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIn(value: string, list: readonly string[]): boolean {
  return list.includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPoint(value: unknown): boolean {
  return (
    isObject(value) &&
    isFiniteNumber(value['x']) &&
    isFiniteNumber(value['y']) &&
    isTilePosition(value['x'], value['y'])
  );
}

function isUnitFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1;
}

function isProp(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isPoint(value) &&
    typeof value['kind'] === 'string' &&
    isIn(value['kind'], ALL_PROP_KINDS) &&
    typeof value['blocking'] === 'boolean' &&
    isUnitFraction(value['variation']) &&
    (value['footprint'] === undefined ||
      (isObject(value['footprint']) &&
        isNonNegativeInt(value['footprint']['width']) &&
        isNonNegativeInt(value['footprint']['height']))) &&
    (value['rotation'] === undefined ||
      (typeof value['rotation'] === 'number' && [0, 1, 2, 3].includes(value['rotation'])))
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
    rooms.length >= ROOM_MIN &&
    rooms.length <= ROOM_MAX &&
    rooms.every(isRoom) &&
    Array.isArray(connections) &&
    connections.length <= ROOM_MAX &&
    connections.every(isConnection) &&
    Array.isArray(thresholds) &&
    thresholds.length <= WIDTH * HEIGHT * 2 &&
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
    route.length <= WIDTH * HEIGHT &&
    route.every((tile) => isNonNegativeInt(tile) && tile < WIDTH * HEIGHT) &&
    isPoint(pathStart) &&
    isPoint(pathEnd)
  );
}

function isArea(value: unknown): boolean {
  return (
    isPoint(value) &&
    isObject(value) &&
    isNonNegativeInt(value['width']) &&
    isNonNegativeInt(value['height']) &&
    value['width'] > 0 &&
    value['width'] <= WIDTH &&
    value['height'] > 0 &&
    value['height'] <= HEIGHT
  );
}

function isCourtyardLayout(value: unknown): boolean {
  return (
    isObject(value) &&
    isTileField(value['tiles']) &&
    isArea(value['bounds']) &&
    isArea(value['encounter']) &&
    Array.isArray(value['approaches']) &&
    value['approaches'].length === 4 &&
    value['approaches'].every(isPoint)
  );
}

function isDecorationBase(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { props, density, revision } = value;
  return (
    Array.isArray(props) &&
    props.length <= WIDTH * HEIGHT * 2 &&
    props.every(isProp) &&
    typeof density === 'string' &&
    isIn(density, ALL_DENSITIES) &&
    isDetailRevision(revision)
  );
}

function isDungeonDecoration(value: unknown): boolean {
  return (
    isDecorationBase(value) &&
    isObject(value) &&
    (value['ritual'] === undefined || typeof value['ritual'] === 'boolean') &&
    typeof value['preset'] === 'string' &&
    isIn(value['preset'], ALL_PRESETS) &&
    (value['furniture'] === undefined ||
      (typeof value['furniture'] === 'string' &&
        isIn(value['furniture'], ALL_DUNGEON_FURNITURE))) &&
    (value['landmark'] === undefined ||
      (typeof value['landmark'] === 'string' && isIn(value['landmark'], ALL_DUNGEON_LANDMARKS))) &&
    (value['scene'] === undefined ||
      (typeof value['scene'] === 'string' && isIn(value['scene'], ALL_DUNGEON_SCENES))) &&
    (value['studySurface'] === undefined ||
      (value['studySurface'] === 1 && value['scene'] === 'Forgotten study'))
  );
}

function isForestDecoration(value: unknown): boolean {
  return (
    isObject(value) &&
    isDecorationBase(value) &&
    (value['forestSurface'] === undefined || value['forestSurface'] === 1) &&
    typeof value['character'] === 'string' &&
    isIn(value['character'], ALL_FOREST_CHARACTERS) &&
    (value['landmark'] === undefined ||
      (typeof value['landmark'] === 'string' && isIn(value['landmark'], ALL_FOREST_LANDMARKS))) &&
    (value['scene'] === undefined ||
      (typeof value['scene'] === 'string' && isIn(value['scene'], ALL_FOREST_SCENES)))
  );
}

function isGeneratedMap(value: unknown): value is GeneratedMap {
  if (!isObject(value)) return false;
  const { type, version, seed, surfaceSeed, layout, decoration } = value;
  if (type !== 'dungeon' && type !== 'forest' && type !== 'courtyard') return false;
  if (typeof version !== 'string' || !version) return false;
  if (typeof seed !== 'string' || !seed || seed !== seed.trim() || seed.length > 64) return false;
  if (!isFiniteNumber(surfaceSeed)) return false;
  if (!isObject(layout) || !isObject(decoration)) return false;
  if (type !== 'forest' && decoration['forestSurface'] !== undefined) return false;
  if (
    type !== 'dungeon' &&
    (decoration['studySurface'] !== undefined || decoration['ritual'] !== undefined)
  )
    return false;
  if (type === 'dungeon') return isDungeonLayout(layout) && isDungeonDecoration(decoration);
  if (type === 'courtyard')
    return (
      isCourtyardLayout(layout) &&
      isDecorationBase(decoration) &&
      typeof decoration['fountain'] === 'boolean'
    );
  return isForestLayout(layout) && isForestDecoration(decoration);
}

function validateMap(map: GeneratedMap): string | undefined {
  if (map.type === 'courtyard') return validateCourtyard(map);
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

export function parseSavedMapBody(
  map: unknown,
  vocabulary: SaveVocabulary,
): GeneratedMap | undefined {
  let normalizedMap: unknown = map;
  if (
    isObject(map) &&
    map['type'] === 'forest' &&
    map['version'] === '3.0.0' &&
    isObject(map['decoration']) &&
    !('character' in map['decoration'])
  ) {
    normalizedMap = {
      ...map,
      decoration: { ...map['decoration'], character: DEFAULT_FOREST_CHARACTER },
    };
  }
  // Retain the stored vocabulary for compatibility checks after bounded shape
  // validation. An old format cannot claim a new ID, nor a new format an alias.
  const storedMap = normalizedMap;
  if (
    isObject(normalizedMap) &&
    normalizedMap['type'] === 'forest' &&
    isObject(normalizedMap['decoration']) &&
    normalizedMap['decoration']['landmark'] === 'Suggested landmark'
  ) {
    normalizedMap = {
      ...normalizedMap,
      decoration: { ...normalizedMap['decoration'], landmark: 'standing-stone-circle' },
    };
  }
  if (!isUsableMap(normalizedMap)) return undefined;
  if (!mapUsesVocabulary(storedMap, vocabulary)) return undefined;
  return normalizedMap;
}
