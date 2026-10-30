import type { GeneratedMap } from '../engine/model';
import { HEIGHT, WIDTH } from '../engine/model';
import { exportBounds } from './export-bounds';
import { PIXELS_PER_TILE } from './resolution';

export const EXPORT_PRESETS = [
  {
    id: 'standard',
    label: 'Standard PNG',
    pixelsPerTile: PIXELS_PER_TILE,
    grid: true,
    guidance: 'A general-purpose PNG at the original resolution. Choose a drawn grid below.',
    guide: null,
  },
  {
    id: 'owlbear',
    label: 'Owlbear Rodeo',
    pixelsPerTile: PIXELS_PER_TILE,
    grid: false,
    guidance: `Keep ${WIDTH}x${HEIGHT} in the filename so Owlbear can align the map automatically. If needed, use Align Image and set ${WIDTH} columns and ${HEIGHT} rows.`,
    guide: 'https://docs.owlbear.rodeo/docs/aligning-a-map/',
  },
  {
    id: 'roll20',
    label: 'Roll20',
    pixelsPerTile: 70,
    grid: false,
    guidance: `Matches Roll20’s default 70 px grid. Set the map image to ${WIDTH} × ${HEIGHT} grid units and use 5 feet per square.`,
    guide: 'https://blog.roll20.net/posts/align-to-grid-new/',
  },
  {
    id: 'foundry',
    label: 'Foundry VTT',
    pixelsPerTile: 100,
    grid: false,
    guidance:
      'Use this PNG as the scene background. Set the scene grid to 100 pixels and the distance to 5 feet per square.',
    guide: 'https://foundryvtt.com/article/scenes/',
  },
] as const;

export type ExportPreset = (typeof EXPORT_PRESETS)[number];

export function exportDimensions(
  pixelsPerTile: number = PIXELS_PER_TILE,
  map?: GeneratedMap,
  towerFloor?: number,
  showSecrets = false,
) {
  if (!EXPORT_PRESETS.some((preset) => preset.pixelsPerTile === pixelsPerTile))
    throw new Error('Choose a supported PNG export resolution.');
  const dimensions = map
    ? exportBounds(map, towerFloor, showSecrets)
    : { width: WIDTH, height: HEIGHT };
  return { width: dimensions.width * pixelsPerTile, height: dimensions.height * pixelsPerTile };
}

export function exportGuidance(
  preset: ExportPreset,
  map: GeneratedMap,
  towerFloor?: number,
  showSecrets = false,
): string {
  const { width, height } = exportBounds(map, towerFloor, showSecrets);
  return preset.guidance
    .replaceAll('40x30', `${width}x${height}`)
    .replaceAll('40 columns and 30 rows', `${width} columns and ${height} rows`)
    .replaceAll('40 × 30', `${width} × ${height}`);
}
