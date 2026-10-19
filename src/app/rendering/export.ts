import { renderDungeon } from './dungeon-renderer';
import { renderForest } from './forest-renderer';
import { EXPORT_HEIGHT, EXPORT_WIDTH, PIXELS_PER_TILE } from './resolution';
import type { Dungeon, ForestClearing, GeneratedMap } from '../engine/model';

export function exportFilename(map: GeneratedMap): string {
  const seed =
    map.seed
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'dungeon';
  const type = map.type;
  if (type === 'dungeon') {
    const preset = map.decoration.preset.toLowerCase();
    return `encounter-${seed}-${preset}-${map.decoration.density.toLowerCase()}-r${map.decoration.revision}-v${map.version}.png`;
  }
  return `encounter-${seed}-forest-${map.decoration.character.toLowerCase()}-${map.decoration.density.toLowerCase()}-r${map.decoration.revision}-v${map.version}.png`;
}

function renderMapToCanvas(
  context: CanvasRenderingContext2D,
  map: GeneratedMap,
  grid: boolean,
): void {
  if (map.type === 'dungeon') {
    renderDungeon(context, map, { grid, pixelsPerTile: PIXELS_PER_TILE });
  } else {
    renderForest(context, map, { grid, pixelsPerTile: PIXELS_PER_TILE });
  }
}

export async function createPng(map: GeneratedMap, grid: boolean): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('PNG export is unavailable because a drawing surface could not be created.');
  renderMapToCanvas(context, map, grid);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not create a PNG. Please try exporting again.'));
    }, 'image/png'),
  );
}

export async function downloadPng(map: GeneratedMap, grid: boolean): Promise<void> {
  const blob = await createPng(map, grid);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename(map);
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
