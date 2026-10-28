import { LANDMARK_CATALOG } from '../../engine/landmark-catalog';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { GeneratedMap } from '../../engine/model';
import { Icon } from '../../icon';
import { Preview } from '../../preview/preview';
import type { Candidate } from '../workbench-session';

@Component({
  selector: 'section[forge-map-panel]',
  imports: [Icon, Preview],
  templateUrl: './map-panel.html',
  styleUrl: './map-panel.scss',
  host: {
    class: 'map-panel',
    'aria-labelledby': 'map-title',
    '[class.focused]': 'focused()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPanel {
  readonly map = input.required<GeneratedMap>();
  readonly grid = input(true);
  readonly disabled = input(false);
  readonly focused = input(false);
  readonly hasPin = input(false);
  readonly candidate = input<Candidate>('current');
  readonly pinRequested = output<void>();
  readonly candidateChanged = output<Candidate>();
  readonly clearPinRequested = output<void>();
  private readonly pinButton = viewChild.required<ElementRef<HTMLButtonElement>>('pinButton');
  readonly gridChanged = output<boolean>();
  readonly focusChanged = output<boolean>();
  private readonly focusButton = viewChild.required<ElementRef<HTMLButtonElement>>('focusButton');

  focusViewControl(): void {
    this.focusButton().nativeElement.focus({ preventScroll: true });
  }

  focusPinControl(): void {
    this.pinButton().nativeElement.focus({ preventScroll: true });
  }

  protected readonly mapTypeLabel = computed(() =>
    this.map().type === 'courtyard'
      ? 'Ruined Courtyard'
      : this.map().type === 'dungeon'
        ? 'Stone Dungeon'
        : 'Forest Clearing',
  );
  protected readonly mapSummary = computed(() => {
    const map = this.map();
    if (map.type === 'courtyard')
      return {
        seed: map.seed,
        rooms: '4 open approaches',
        details: `Overgrown ruin${map.decoration.fountain ? ' · Dry fountain' : ''} · ${map.decoration.density} r${map.decoration.revision}`,
        type: 'RUINED COURTYARD',
      };
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
