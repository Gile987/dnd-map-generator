import type { GeneratedMap } from '../engine/model';
import type { DrawingContext } from './drawing-context';
import type { RenderOptions } from './render-options';
import { renderDungeon } from './dungeon-renderer';
import { renderForest } from './forest-renderer';
import { renderCourtyard } from './courtyard-renderer';

export function renderMap(ctx: DrawingContext, map: GeneratedMap, options: RenderOptions): void {
  switch (map.type) {
    case 'dungeon':
      return renderDungeon(ctx, map, options);
    case 'forest':
      return renderForest(ctx, map, options);
    case 'courtyard':
      return renderCourtyard(ctx, map, options);
    default: {
      const unhandled: never = map;
      throw new Error(`Unsupported map type: ${unhandled}`);
    }
  }
}
