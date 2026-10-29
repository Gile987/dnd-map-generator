import { renderMap } from './render-map';
import { PIXELS_PER_TILE } from './resolution';
import { mapDimensions } from '../engine/model';
import type { GeneratedMap } from '../engine/model';
import { EXPORT_PRESETS, exportDimensions } from './export-presets';
import type { ExportPreset } from './export-presets';
import { downloadBlob } from '../browser/download';

export function exportFilename(map: GeneratedMap, showSecrets = false): string {
  const seed =
    map.seed
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'dungeon';
  const type = map.type;
  if (type === 'tower')
    return `encounter-${seed}-tower-${map.layout.floors.length}floors${map.layout.stairStyle ? '-' + map.layout.stairStyle : ''}-${map.decoration.density.toLowerCase()}-r${map.decoration.revision}-v${map.version}${map.layout.portalFloor !== null ? (showSecrets ? '-gm-secrets' : '-player') : ''}.png`;
  if (type === 'courtyard')
    return `encounter-${seed}-courtyard${map.decoration.fountain ? '-dry-fountain' : ''}-${map.decoration.density.toLowerCase()}-r${map.decoration.revision}-v${map.version}.png`;
  if (type === 'dungeon') {
    const preset = map.decoration.preset.toLowerCase();
    const scene = map.decoration.scene === 'Forgotten study' ? '-forgotten-study' : '';
    return `encounter-${seed}-${preset}${map.decoration.ritual ? '-ritual-site' : ''}${map.decoration.furniture === 'dining-table' ? '-dining-table' : ''}${map.decoration.landmark && map.decoration.landmark !== 'None' ? '-' + map.decoration.landmark : ''}${scene}-${map.decoration.density.toLowerCase()}-r${map.decoration.revision}-v${map.version}.png`;
  }
  const scene = map.decoration.scene === 'Abandoned camp' ? '-abandoned-camp' : '';
  return `encounter-${seed}-forest-${map.decoration.character.toLowerCase()}${map.decoration.landmark && map.decoration.landmark !== 'None' ? '-' + map.decoration.landmark : ''}${scene}-${map.decoration.density.toLowerCase()}-r${map.decoration.revision}-v${map.version}.png`;
}

export function configuredExportFilename(
  map: GeneratedMap,
  grid: boolean,
  opacity: number,
  preset: ExportPreset = EXPORT_PRESETS[0],
  showSecrets = false,
): string {
  const suffix = grid ? `grid-${opacity}pct` : 'grid-off';
  const { width, height } = mapDimensions(map);
  const target =
    preset.id === 'standard' ? '' : `-${preset.id}-${width}x${height}-${preset.pixelsPerTile}px`;
  return exportFilename(map, showSecrets).replace(/\.png$/, `${target}-${suffix}.png`);
}

export async function createPng(
  map: GeneratedMap,
  grid: boolean,
  gridOpacity?: number,
  pixelsPerTile: number = PIXELS_PER_TILE,
  showSecrets = false,
): Promise<Blob> {
  const dimensions = exportDimensions(pixelsPerTile, map);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('PNG export is unavailable because a drawing surface could not be created.');
  renderMap(context, map, { grid, gridOpacity, pixelsPerTile, showSecrets });
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not create a PNG. Please try exporting again.'));
    }, 'image/png'),
  );
}

export async function downloadPng(
  map: GeneratedMap,
  grid: boolean,
  showSecrets = false,
): Promise<void> {
  const blob = await createPng(map, grid, undefined, PIXELS_PER_TILE, showSecrets);
  downloadBlob(blob, exportFilename(map, showSecrets));
}
