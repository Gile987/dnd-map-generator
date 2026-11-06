import type { Point, PropKind, QuarterTurn } from '../model';

export const MAX_AUTHORED_OBJECTS = 120;
export type ObjectCommand =
  | {
      readonly kind: 'move-group';
      readonly id: string;
      readonly target: Point;
      readonly rotation?: QuarterTurn;
    }
  | { readonly kind: 'move'; readonly id: string; readonly target: Point }
  | {
      readonly kind: 'add';
      readonly propKind: PropKind;
      readonly target: Point;
      readonly floor?: number;
    }
  | { readonly kind: 'remove'; readonly id: string }
  | { readonly kind: 'order'; readonly id: string; readonly direction: 'forward' | 'backward' }
  | { readonly kind: 'reset' };
export type ObjectEditResult<Document> =
  | { readonly ok: true; readonly document: Document }
  | { readonly ok: false; readonly error: string };
