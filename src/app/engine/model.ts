export const WIDTH = 40;
export const HEIGHT = 30;
export const GENERATOR_VERSION = '2.0.0';

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

export type DecorationPreset = 'Mosslit' | 'Crypt' | 'Storehouse' | 'Sanctuary';

export const DEFAULT_PRESET: DecorationPreset = 'Mosslit';

export const ALL_PRESETS: readonly DecorationPreset[] = [
  'Mosslit',
  'Crypt',
  'Storehouse',
  'Sanctuary',
];

export interface Settings {
  readonly seed: string;
  readonly roomCount: number;
  readonly density: Density;
  readonly preset: DecorationPreset;
}

export interface Prop extends Point {
  readonly kind:
    | 'crate'
    | 'barrel'
    | 'rubble'
    | 'rug'
    | 'sconce'
    | 'moss'
    | 'sarcophagus'
    | 'vine'
    | 'broken_column';
  readonly blocking: boolean;
  readonly variation: number;
}

export interface Decoration {
  readonly props: readonly Prop[];
  readonly density: Density;
  readonly preset: DecorationPreset;
  readonly revision: number;
}

export interface Dungeon {
  readonly version: string;
  readonly seed: string;
  readonly layout: Layout;
  readonly decoration: Decoration;
  readonly surfaceSeed: number;
}

export type GenerationResult =
  { readonly ok: true; readonly map: Dungeon } | { readonly ok: false; readonly error: string };

export const indexOf = (x: number, y: number): number => y * WIDTH + x;

export function isFloor(layout: Pick<Layout, 'tiles'>, x: number, y: number): boolean {
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

export function isBlockingProp(kind: Prop['kind']): boolean {
  return (
    kind === 'crate' ||
    kind === 'barrel' ||
    kind === 'rubble' ||
    kind === 'sarcophagus' ||
    kind === 'broken_column'
  );
}

export function center(room: Room): Point {
  return { x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) };
}
