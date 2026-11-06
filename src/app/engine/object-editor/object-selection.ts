import type { Point, Prop, QuarterTurn } from '../model';
import type { FootprintShape, ReservedArea } from '../feature-reservation';

export interface ObjectSelection<GroupId extends string = string> {
  readonly id: string;
  readonly groupId?: GroupId;
  readonly architecture?: 'stairs';
  readonly rotation?: QuarterTurn;
  readonly label: string;
  readonly position: Point;
  readonly area: ReservedArea;
  readonly footprint?: readonly FootprintShape[];
  readonly props: readonly Prop[];
  readonly members: readonly string[];
  readonly removable: boolean;
  readonly lock?: string;
}
