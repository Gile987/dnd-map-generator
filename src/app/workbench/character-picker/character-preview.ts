import { Directive, computed, input } from '@angular/core';
import { characterSample } from '../../rendering/character-sample';
import type { CharacterSample } from '../../rendering/character-sample';
import { renderMap } from '../../rendering/render-map';
import { EXPORT_WIDTH, EXPORT_HEIGHT, PIXELS_PER_TILE } from '../../rendering/resolution';

// Eight fixed choices: cache only the small image URLs, not full-size canvases or maps.
const images = new Map<string, string>();

@Directive({ selector: 'img[forgeCharacterPreview]', host: { '[src]': 'source()' } })
export class CharacterPreview {
  readonly choice = input.required<CharacterSample>({ alias: 'forgeCharacterPreview' });
  protected readonly source = computed(() => {
    const choice = this.choice(),
      key = `${choice.type}:${choice.id}`;
    const cached = images.get(key);
    if (cached) return cached;
    const full = document.createElement('canvas');
    full.width = EXPORT_WIDTH;
    full.height = EXPORT_HEIGHT;
    const context = full.getContext('2d');
    if (!context) return '';
    const { map, region } = characterSample(choice);
    renderMap(context, map, { grid: false, pixelsPerTile: PIXELS_PER_TILE });
    const preview = document.createElement('canvas');
    preview.width = 480;
    preview.height = 300;
    const target = preview.getContext('2d');
    if (!target) return '';
    target.drawImage(
      full,
      region.x * PIXELS_PER_TILE,
      region.y * PIXELS_PER_TILE,
      region.width * PIXELS_PER_TILE,
      region.height * PIXELS_PER_TILE,
      0,
      0,
      480,
      300,
    );
    const url = preview.toDataURL();
    images.set(key, url);
    return url;
  });
}
