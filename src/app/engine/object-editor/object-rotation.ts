import type { Prop, PropKind, QuarterTurn } from '../model';
import { MULTI_TILE_PROPS, QUARTER_TURNS } from '../prop-footprint';

export function objectRotation(prop: Prop): QuarterTurn {
  return prop.footprint ? (prop.rotation ?? 0) : (prop.artRotation ?? 0);
}
export function initialOrientation(
  kind: PropKind,
  rotation: QuarterTurn = 0,
): Pick<Prop, 'footprint' | 'rotation' | 'artRotation'> {
  return kind === 'wooden_bench'
    ? { footprint: { ...MULTI_TILE_PROPS.wooden_bench }, rotation }
    : rotation
      ? { artRotation: rotation }
      : {};
}
/** Multi-square furniture turns its footprint; other independent objects turn artwork only. */
export function withObjectRotation(prop: Prop, rotation: QuarterTurn): Prop {
  const { artRotation: _rotation, ...rest } = prop;
  return prop.footprint
    ? { ...rest, rotation }
    : rotation
      ? { ...rest, artRotation: rotation }
      : rest;
}
export function validStoredRotation(value: Record<string, unknown>): boolean {
  return value['artRotation'] === undefined || [1, 2, 3].includes(value['artRotation'] as number);
}
/** Only authored benches accept a multi-square shape; never normalize malformed imports. */
export function authoredOrientation(
  value: Record<string, unknown>,
): Pick<Prop, 'footprint' | 'rotation' | 'artRotation'> | undefined {
  if (value['kind'] === 'wooden_bench') {
    const shape = value['footprint'];
    if (
      'artRotation' in value ||
      typeof shape !== 'object' ||
      shape === null ||
      Array.isArray(shape)
    )
      return undefined;
    const fields = shape as Record<string, unknown>;
    if (
      Object.keys(fields).length !== 2 ||
      fields['width'] !== 2 ||
      fields['height'] !== 1 ||
      !QUARTER_TURNS.some((turn) => turn === value['rotation'])
    )
      return undefined;
    return initialOrientation('wooden_bench', value['rotation'] as QuarterTurn);
  }
  if ('footprint' in value || 'rotation' in value || !validStoredRotation(value)) return undefined;
  return value['artRotation'] ? { artRotation: value['artRotation'] as QuarterTurn } : {};
}
