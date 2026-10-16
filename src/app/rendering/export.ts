import { renderDungeon } from './dungeon-renderer';
import { EXPORT_HEIGHT, EXPORT_WIDTH, PIXELS_PER_TILE } from './resolution';
import type { Dungeon } from '../engine/model';

export function exportFilename(map: Dungeon): string {
  const seed =
    map.seed
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'dungeon';
  const preset = map.decoration.preset.toLowerCase();
  return `encounter-${seed}-${preset}-${map.decoration.density.toLowerCase()}-r${map.decoration.revision}-v${map.version}.png`;
}

export async function createPng(map: Dungeon, grid: boolean): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('PNG export is unavailable because a drawing surface could not be created.');
  renderDungeon(context, map, { grid, pixelsPerTile: PIXELS_PER_TILE });
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not create a PNG. Please try exporting again.'));
    }, 'image/png'),
  );
}

export async function downloadPng(map: Dungeon, grid: boolean): Promise<void> {
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
