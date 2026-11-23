import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { OBJECT_SHORTCUT_GROUPS } from './shortcuts';

@Component({
  selector: 'forge-keyboard-shortcuts',
  templateUrl: './keyboard-shortcuts.html',
  styleUrl: './keyboard-shortcuts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyboardShortcuts {
  readonly editing = input(false);
  protected readonly groups = computed(() => {
    const navigation = {
      title: 'Map navigation',
      rows: [
        { label: '+ / −', description: 'Zoom in / out' },
        { label: 'Home', description: 'Fit the map' },
        { label: 'Arrow keys', description: 'Pan in Explore mode' },
        { label: '?', description: 'Open this help' },
      ],
    };
    return this.editing()
      ? [...OBJECT_SHORTCUT_GROUPS, navigation]
      : [navigation, ...OBJECT_SHORTCUT_GROUPS];
  });
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | undefined;
  open(): void {
    if (this.dialog().nativeElement.open) return;
    this.opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.dialog().nativeElement.showModal();
  }
  protected close(event?: Event): void {
    event?.preventDefault();
    this.dialog().nativeElement.close();
  }
  protected closed(): void {
    if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    this.opener = undefined;
  }
}
