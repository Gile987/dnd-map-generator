export interface RenderOptions {
  readonly grid: boolean;
  /** Overrides the grid's original opacity when supplied; a fraction from 0 to 1. */
  readonly gridOpacity?: number;
  readonly pixelsPerTile: number;
}
