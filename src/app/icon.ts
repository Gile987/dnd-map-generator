import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const paths = {
  dice: 'm12 3 9 5v9l-9 5-9-5V8l9-5Zm0 0v9m-9-4 9 4 9-4m-9 4v10',
  spark: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4m-2-2h4',
  shuffle:
    'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3.5-2 5-5m3-4c1.5-2 2.5-3 4-3h3m-4-4 4 4-4 4',
  undo: 'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12',
  redo: 'm15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  grid: 'M3 3h18v18H3V3Zm6 0v18m6-18v18M3 9h18M3 15h18',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  layers: 'm12 3 10 6-10 6L2 9l10-6ZM2 14l10 6 10-6M2 18l10 6 10-6',
  compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-6-3-2 4-4 2 2-4 4-2Z',
  check: 'm5 12 4 4L19 6',
  lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4',
  stairs: 'M3 20h6v-5h5v-5h5V4h3',
  hand: 'M7 11V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v7c0 5-3 7-7 7h-1c-3 0-5-2-7-5l-4-6a2 2 0 0 1 3-2l4 4',
  tree: 'M12 21v-6m-4 0h8m-8 0-4 4m12-4 4 4M12 3c-3 0-6 2-6 5 0 2 1.5 3 3 3.5C7.5 12.5 6 13.5 6 15c0 2 2.5 3 6 3s6-1 6-3c0-1.5-1.5-2.5-3-3.5 1.5-.5 3-1.5 3-3.5 0-3-3-5-6-5Z',
  star: 'M12 4.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 16.6l-4.7 2.35.9-5.23-3.8-3.7 5.25-.76L12 4.5Z',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 20h16',
} as const;

export type IconName = keyof typeof paths;

@Component({
  selector: 'forge-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()" /></svg>',
  styles:
    ':host { display: inline-flex; width: 1.15rem; height: 1.15rem; flex: 0 0 auto; } svg { width: 100%; height: 100%; }',
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly path = computed(() => paths[this.name()]);
}
