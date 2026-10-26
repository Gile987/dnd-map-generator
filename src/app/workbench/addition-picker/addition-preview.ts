import { Directive, computed, input } from '@angular/core';
import type { LandmarkId } from '../../engine/landmark-catalog';
import { isBlockingProp } from '../../engine/model';
import type { Prop, PropKind } from '../../engine/model';
import { drawProp } from '../../rendering/props';

export type AdditionId = LandmarkId | 'forgotten-study' | 'abandoned-camp' | 'dining-table';

function prop(kind: PropKind, x: number, y: number, variation = 0.3): Prop {
  return { kind, x, y, variation, blocking: isBlockingProp(kind) };
}

// Illustrations reuse the actual prop artwork without generating or changing a map.
const illustrations: Readonly<
  Record<AdditionId, { width: number; height: number; forest?: boolean; props: readonly Prop[] }>
> = {
  'forgotten-study': {
    width: 5,
    height: 4,
    props: [
      prop('rug', 3, 2),
      prop('bookshelf', 1, 0, 0),
      prop('desk', 1, 2, 0),
      prop('scroll_case', 2, 1, 0),
    ],
  },
  'weathered-statue': { width: 3, height: 3, props: [prop('weathered_statue', 1, 1)] },
  'dining-table': {
    width: 4,
    height: 3,
    props: [{ ...prop('dining_table', 1, 1), footprint: { width: 2, height: 1 }, rotation: 0 }],
  },
  'abandoned-camp': {
    width: 7,
    height: 5,
    forest: true,
    props: [
      prop('tent', 1, 1, 0.2),
      prop('tent', 5, 1, 0.7),
      prop('bedroll', 1, 3),
      prop('bedroll', 5, 3),
      prop('fire_ring', 3, 2),
      prop('supply_bundle', 4, 1),
    ],
  },
  'standing-stone-circle': {
    width: 7,
    height: 7,
    forest: true,
    props: (
      [
        [3, 1],
        [5, 2],
        [5, 4],
        [3, 5],
        [1, 4],
        [1, 2],
      ] as const
    ).map(([x, y]) => prop('standing_stone', x, y)),
  },
};

@Directive({ selector: 'img[forgeAdditionPreview]', host: { '[src]': 'source()' } })
export class AdditionPreview {
  readonly id = input.required<AdditionId>({ alias: 'forgeAdditionPreview' });
  protected readonly source = computed(() => {
    const scene = illustrations[this.id()];
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = scene.forest ? '#506847' : '#536863';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(440 / scene.width, 260 / scene.height);
    ctx.translate((480 - scene.width * scale) / 2, (300 - scene.height * scale) / 2);
    ctx.scale(scale, scale);
    ctx.strokeStyle = scene.forest ? '#354c3440' : '#334b4840';
    ctx.lineWidth = 0.018;
    for (let y = 0; y < scene.height; y++)
      for (let x = 0; x < scene.width; x++) {
        ctx.fillStyle = scene.forest
          ? (x + y) % 2
            ? '#6e82551f'
            : '#80956b1f'
          : (x + y) % 2
            ? '#8aa19a28'
            : '#a1aca020';
        ctx.fillRect(x, y, 1, 1);
        ctx.strokeRect(x, y, 1, 1);
      }
    for (const object of scene.props) drawProp(ctx, object);
    return canvas.toDataURL();
  });
}
