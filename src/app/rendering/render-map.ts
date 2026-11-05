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
      return renderTower(ctx, map, options);
    case 'dungeon':
      renderDungeon(ctx, resolveDungeon(map), options);
      if (options.showLayerIndicators) drawObjectLayerIndicators(ctx, map, options.pixelsPerTile);
      return;
    case 'forest':
      return renderForest(ctx, map, options);
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
