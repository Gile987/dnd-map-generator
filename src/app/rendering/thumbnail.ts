import { HEIGHT, WIDTH } from '../engine/model';
import type { GeneratedMap } from '../engine/model';
import { renderMap } from './render-map';

const THUMBNAIL_PIXELS_PER_TILE = 8;

export function createThumbnail(map: GeneratedMap): string {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * THUMBNAIL_PIXELS_PER_TILE;
  canvas.height = HEIGHT * THUMBNAIL_PIXELS_PER_TILE;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('A thumbnail could not be created because a drawing surface was unavailable.');
  renderMap(context, map, { grid: false, pixelsPerTile: THUMBNAIL_PIXELS_PER_TILE });
  return canvas.toDataURL('image/png');
}
