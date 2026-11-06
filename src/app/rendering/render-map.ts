import { resolveTower } from '../engine/object-editor/tower-document';
import { resolveForest } from '../engine/object-editor/forest-document';
import { resolveCourtyard } from '../engine/object-editor/courtyard-document';
import { drawObjectLayerIndicators } from './dungeon-layer-indicators';
import { resolveDungeon } from '../engine/object-editor/document';
import { renderTower } from './tower-renderer';
import type { MapDocument } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import type { RenderOptions } from './render-options';
import { renderDungeon } from './dungeon-renderer';
import { renderForest } from './forest-renderer';
import { renderCourtyard } from './courtyard-renderer';

export function renderMap(ctx: DrawingContext, map: MapDocument, options: RenderOptions): void {
  switch (map.type) {
    case 'tower':
      renderTower(ctx, resolveTower(map), options);
      if (options.showLayerIndicators)
        drawObjectLayerIndicators(ctx, map, options.pixelsPerTile, options.showSecrets);
      return;
    case 'dungeon':
      renderDungeon(ctx, resolveDungeon(map), options);
      if (options.showLayerIndicators) drawObjectLayerIndicators(ctx, map, options.pixelsPerTile);
      return;
    case 'forest':
      renderForest(ctx, resolveForest(map), options);
      if (options.showLayerIndicators) drawObjectLayerIndicators(ctx, map, options.pixelsPerTile);
      return;
    case 'courtyard':
      renderCourtyard(ctx, resolveCourtyard(map), options);
      if (options.showLayerIndicators) drawObjectLayerIndicators(ctx, map, options.pixelsPerTile);
      return;
    default: {
      const unhandled: never = map;
      throw new Error(`Unsupported map type: ${unhandled}`);
    }
  }
}
