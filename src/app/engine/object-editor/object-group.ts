import type { Point, QuarterTurn } from '../model';
import type { ReservedArea } from '../feature-reservation';

export interface ObjectGroup<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly members: readonly string[];
  readonly area: ReservedArea;
}
export interface ObjectGroupTransform<Id extends string = string> extends Point {
  readonly id: Id;
  readonly rotation: QuarterTurn;
}
