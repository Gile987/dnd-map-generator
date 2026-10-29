import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../../icon';
import type { DraftChange } from '../settings-draft';
import { CharacterPreview } from './character-preview';
import type { CharacterOption } from './character-options';

@Component({
  selector: 'forge-character-picker',
  imports: [Icon, CharacterPreview],
  templateUrl: './character-picker.html',
  styleUrl: './character-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterPicker {
  readonly options = input.required<readonly CharacterOption[]>();
  readonly selected = input.required<string>();
  readonly disabled = input(false);
  readonly changed = output<DraftChange>();
  protected readonly visible = signal(false);
  protected readonly selectedLabel = computed(
    () => this.options().find((item) => item.id === this.selected())?.label ?? '',
  );
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  show(): void {
    if (this.disabled() || this.dialog().nativeElement.open) return;
    this.visible.set(true);
    this.dialog().nativeElement.showModal();
  }

  protected choose(option: CharacterOption): void {
    if (this.disabled()) return;
    this.changed.emit(
      option.type === 'dungeon'
        ? { type: 'dungeon', changes: { preset: option.id } }
        : { type: 'forest', changes: { character: option.id } },
    );
  }

  protected reveal(event: FocusEvent): void {
    if (event.target instanceof HTMLInputElement)
      event.target.closest('label')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected closed(): void {
    if (!this.dialog().nativeElement.open) this.visible.set(false);
  }
}
