import { HEIGHT, WIDTH } from '../engine/model';
import type { GeneratedMap } from '../engine/model';
import { renderDungeon } from './dungeon-renderer';
import { renderForest } from './forest-renderer';

const THUMBNAIL_PIXELS_PER_TILE = 8;

export function createThumbnail(map: GeneratedMap): string {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * THUMBNAIL_PIXELS_PER_TILE;
  canvas.height = HEIGHT * THUMBNAIL_PIXELS_PER_TILE;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('A thumbnail could not be created because a drawing surface was unavailable.');
  if (map.type === 'dungeon') {
    renderDungeon(context, map, { grid: false, pixelsPerTile: THUMBNAIL_PIXELS_PER_TILE });
  } else {
    renderForest(context, map, { grid: false, pixelsPerTile: THUMBNAIL_PIXELS_PER_TILE });
  }
  return canvas.toDataURL('image/png');
}
