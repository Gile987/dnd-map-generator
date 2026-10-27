import { landmarkIdsFor } from './landmark-catalog';
import type { LandmarkIdFor } from './landmark-catalog';

export const WIDTH = 40;
export const HEIGHT = 30;
export const ROOM_MIN = 4;
export const ROOM_MAX = 8;
export const GENERATOR_VERSION = '4.0.0';

export type MapType = 'dungeon' | 'forest' | 'courtyard';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Room extends Point {
  readonly id: number;
  readonly width: number;
  readonly height: number;
}

export interface Connection {
  readonly from: number;
  readonly to: number;
  readonly bend: 'horizontal' | 'vertical';
}

export interface Threshold extends Point {
  readonly axis: 'horizontal' | 'vertical';
  readonly span: 2;
  readonly roomId: number;
}

export interface Landmark extends Point {
  readonly roomId: number;
}

export interface Layout {
  readonly tiles: readonly boolean[];
  readonly rooms: readonly Room[];
  readonly connections: readonly Connection[];
  readonly thresholds: readonly Threshold[];
  readonly entrance: Landmark;
  readonly objective: Landmark;
}

export type Density = 'Sparse' | 'Balanced' | 'Cluttered';

export const ALL_DENSITIES: readonly Density[] = ['Sparse', 'Balanced', 'Cluttered'];

export const DENSITY_BUDGETS: Readonly<Record<Density, number>> = {
  Sparse: 0.05,
  Balanced: 0.1,
  Cluttered: 0.15,
};

export type DecorationPreset = 'Mosslit' | 'Crypt' | 'Storehouse' | 'Sanctuary';

export const DEFAULT_PRESET: DecorationPreset = 'Mosslit';

export const ALL_PRESETS: readonly DecorationPreset[] = [
  'Mosslit',
  'Crypt',
  'Storehouse',
  'Sanctuary',
];

export type ForestCharacter = 'Verdant' | 'Autumn' | 'Pines' | 'Fey';
export type DungeonFurniture = 'None' | 'dining-table';
export const ALL_DUNGEON_FURNITURE: readonly DungeonFurniture[] = ['None', 'dining-table'];
export type QuarterTurn = 0 | 1 | 2 | 3;

export type DungeonScene = 'None' | 'Forgotten study';
export const ALL_DUNGEON_SCENES: readonly DungeonScene[] = ['None', 'Forgotten study'];
export type DungeonLandmark = 'None' | LandmarkIdFor<'dungeon'>;
export const ALL_DUNGEON_LANDMARKS: readonly DungeonLandmark[] = [
  'None',
  ...landmarkIdsFor('dungeon'),
];
export type ForestLandmark = 'None' | LandmarkIdFor<'forest'>;
export const ALL_FOREST_LANDMARKS: readonly ForestLandmark[] = [
  'None',
  ...landmarkIdsFor('forest'),
];

export type ForestScene = 'None' | 'Abandoned camp';
export const ALL_FOREST_SCENES: readonly ForestScene[] = ['None', 'Abandoned camp'];

export const DEFAULT_FOREST_CHARACTER: ForestCharacter = 'Verdant';

export const ALL_FOREST_CHARACTERS: readonly ForestCharacter[] = [
  'Verdant',
  'Autumn',
  'Pines',
  'Fey',
];

export interface DungeonSettings {
  readonly seed: string;
  readonly roomCount: number;
  readonly density: Density;
  readonly preset: DecorationPreset;
  readonly scene?: DungeonScene;
  readonly landmark?: DungeonLandmark;
  readonly furniture?: DungeonFurniture;
}

export interface ForestSettings {
  readonly seed: string;
  readonly density: Density;
  readonly character: ForestCharacter;
  readonly scene?: ForestScene;
  readonly landmark?: ForestLandmark;
}

export interface CourtyardSettings {
  readonly seed: string;
  readonly density: Density;
  readonly fountain: boolean;
}

export interface TileArea extends Point {
  readonly width: number;
  readonly height: number;
}

export interface CourtyardLayout {
  // All grass and paving are walkable; false tiles are standing masonry.
  readonly tiles: readonly boolean[];
  readonly bounds: TileArea;
  // Centers of three-tile openings, in north/east/south/west order.
  readonly approaches: readonly Point[];
  readonly encounter: TileArea;
}

export interface RuinedCourtyard {
  readonly type: 'courtyard';
  readonly version: string;
  readonly seed: string;
  readonly layout: CourtyardLayout;
  readonly surfaceSeed: number;
  readonly decoration: {
    readonly props: readonly Prop[];
    readonly density: Density;
    readonly fountain: boolean;
    readonly revision: number;
  };
}

export type MapSettings =
  | (DungeonSettings & { readonly mapType: 'dungeon' })
  | (ForestSettings & { readonly mapType: 'forest' })
  | (CourtyardSettings & { readonly mapType: 'courtyard' });

export const DUNGEON_PROP_KINDS = [
  'crate',
  'barrel',
  'rubble',
  'rug',
  'sconce',
  'moss',
  'sarcophagus',
  'vine',
  'broken_column',
  'desk',
  'bookshelf',
  'scroll_case',
  'weathered_statue',
  'dining_table',
] as const;

export const FOREST_PROP_KINDS = [
  'tree',
  'boulder',
  'fern',
  'mushroom',
  'bush',
  'log',
  'stump',
  'flower',
  'tent',
  'bedroll',
  'fire_ring',
  'supply_bundle',
  'standing_stone',
] as const;

export type DungeonPropKind = (typeof DUNGEON_PROP_KINDS)[number];
export type ForestPropKind = (typeof FOREST_PROP_KINDS)[number];
export const COURTYARD_PROP_KINDS = [
  'broken_column',
  'moss',
  'fern',
  'vine',
  'low_rubble',
  'dry_fountain',
] as const;
export type PropKind = DungeonPropKind | ForestPropKind | 'low_rubble' | 'dry_fountain';

export const ALL_PROP_KINDS: readonly PropKind[] = [
  ...DUNGEON_PROP_KINDS,
  ...FOREST_PROP_KINDS,
  'low_rubble',
  'dry_fountain',
];

export function isDungeonPropKind(kind: PropKind): kind is DungeonPropKind {
  return DUNGEON_PROP_KINDS.some((candidate) => candidate === kind);
}

export function isForestPropKind(kind: PropKind): kind is ForestPropKind {
  return FOREST_PROP_KINDS.some((candidate) => candidate === kind);
}

export interface Prop extends Point {
  readonly kind: PropKind;
  readonly blocking: boolean;
  readonly variation: number;
  readonly footprint?: { readonly width: number; readonly height: number };
  readonly rotation?: QuarterTurn;
}

export interface Decoration {
  readonly props: readonly Prop[];
  readonly density: Density;
  readonly preset: DecorationPreset;
  readonly scene?: DungeonScene;
  readonly landmark?: DungeonLandmark;
  readonly furniture?: DungeonFurniture;
  readonly revision: number;
}

export interface ForestDecoration {
  readonly props: readonly Prop[];
  readonly density: Density;
  readonly character: ForestCharacter;
  readonly scene?: ForestScene;
  readonly landmark?: ForestLandmark;
  readonly revision: number;
}

export interface ForestLayout {
  readonly tiles: readonly boolean[];
  readonly route: readonly number[];
  readonly pathStart: Point;
  readonly pathEnd: Point;
}

export interface Dungeon {
  readonly type: 'dungeon';
  readonly version: string;
  readonly seed: string;
  readonly layout: Layout;
  readonly decoration: Decoration;
  readonly surfaceSeed: number;
}

export interface ForestClearing {
  readonly type: 'forest';
  readonly version: string;
  readonly seed: string;
  readonly layout: ForestLayout;
  readonly decoration: ForestDecoration;
  readonly surfaceSeed: number;
}

export type GeneratedMap = Dungeon | ForestClearing | RuinedCourtyard;

export type GenerationResult =
  { readonly ok: true; readonly map: Dungeon } | { readonly ok: false; readonly error: string };

export type ForestGenerationResult =
  | { readonly ok: true; readonly map: ForestClearing }
  | { readonly ok: false; readonly error: string };

export const indexOf = (x: number, y: number): number => y * WIDTH + x;

export function isTilePosition(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
}

export function isFloor(layout: Pick<Layout, 'tiles'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && layout.tiles[indexOf(x, y)] === true;
}

export function isWalkable(layout: Pick<ForestLayout, 'tiles'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && layout.tiles[indexOf(x, y)] === true;
}

export function contains(room: Room, point: Point): boolean {
  return (
    point.x >= room.x &&
    point.y >= room.y &&
    point.x < room.x + room.width &&
    point.y < room.y + room.height
  );
}

export function isBlockingProp(kind: PropKind): boolean {
  return (
    kind === 'crate' ||
    kind === 'barrel' ||
    kind === 'rubble' ||
    kind === 'sarcophagus' ||
    kind === 'broken_column' ||
    kind === 'boulder' ||
    kind === 'log' ||
    kind === 'stump' ||
    kind === 'tent' ||
    kind === 'supply_bundle' ||
    kind === 'desk' ||
    kind === 'bookshelf' ||
    kind === 'dining_table' ||
    kind === 'weathered_statue' ||
    kind === 'standing_stone' ||
    kind === 'dry_fountain'
  );
}

export function center(room: Room): Point {
  return { x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) };
}
