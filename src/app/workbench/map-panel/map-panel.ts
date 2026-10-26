import { LANDMARK_CATALOG } from '../../engine/landmark-catalog';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { GeneratedMap } from '../../engine/model';
import { Icon } from '../../icon';
import { Preview } from '../../preview/preview';

@Component({
  selector: 'section[forge-map-panel]',
  imports: [Icon, Preview],
  templateUrl: './map-panel.html',
  styleUrl: './map-panel.scss',
  host: { class: 'map-panel', 'aria-labelledby': 'map-title' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPanel {
  readonly map = input.required<GeneratedMap>();
  readonly grid = input(true);
  readonly disabled = input(false);
  readonly gridChanged = output<boolean>();

  protected readonly mapTypeLabel = computed(() =>
    this.map().type === 'dungeon' ? 'Stone Dungeon' : 'Forest Clearing',
  );
  protected readonly mapSummary = computed(() => {
    const map = this.map();
    if (map.type === 'dungeon') {
      return {
        seed: map.seed,
        rooms: `${map.layout.rooms.length} connected`,
        details: `${map.decoration.preset}${map.decoration.furniture === 'dining-table' ? ' · Dining table' : ''}${map.decoration.landmark && map.decoration.landmark !== 'None' ? ' · ' + LANDMARK_CATALOG[map.decoration.landmark].label : ''}${map.decoration.scene === 'Forgotten study' ? ' · Forgotten study' : ''} · ${map.decoration.density} r${map.decoration.revision}`,
        type: 'STONE DUNGEON',
      };
    }
    return {
      seed: map.seed,
      rooms: map.decoration.scene === 'Abandoned camp' ? 'Abandoned camp' : 'Open clearing',
      details: `${map.decoration.character}${map.decoration.landmark && map.decoration.landmark !== 'None' ? ' · ' + LANDMARK_CATALOG[map.decoration.landmark].label : ''} · ${map.decoration.density} r${map.decoration.revision}`,
      type: 'FOREST CLEARING',
    };
  });
}
