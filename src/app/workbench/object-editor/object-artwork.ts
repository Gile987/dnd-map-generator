import { FOREST_PALETTES } from '../../rendering/forest-palette';
import { Directive, computed, input } from '@angular/core';
import type { PropKind, ForestCharacter, CourtyardCharacter } from '../../engine/model';
import { isBlockingProp } from '../../engine/model';
import { drawProp } from '../../rendering/props';

@Directive({ selector: 'img[forgeObjectArtwork]', host: { '[src]': 'source()' } })
export class ObjectArtwork {
  readonly kind = input.required<PropKind>({ alias: 'forgeObjectArtwork' });
  readonly forestCharacter = input<ForestCharacter | undefined>();
  readonly courtyardCharacter = input<CourtyardCharacter | undefined>();
  protected readonly source = computed(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#536863';
    ctx.fillRect(0, 0, 80, 80);
    const scale = this.kind() === 'rug' ? 25 : 64;
    ctx.translate(40, 40);
    ctx.scale(scale, scale);
    ctx.translate(-0.5, -0.5);
    const character = this.forestCharacter();
    drawProp(
      ctx,
      {
        kind: this.kind(),
        x: 0,
        y: 0,
        blocking: isBlockingProp(this.kind()),
        variation: 0.5,
      },
      character ? FOREST_PALETTES[character] : undefined,
      this.courtyardCharacter(),
    );
    return canvas.toDataURL();
  });
}
