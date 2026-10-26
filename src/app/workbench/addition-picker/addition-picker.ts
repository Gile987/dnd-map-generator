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
import type { DraftChange } from '../settings-draft';
import { AdditionPreview } from './addition-preview';
import type { AdditionId } from './addition-preview';
import { Icon } from '../../icon';

export interface MapAddition {
  readonly id: AdditionId;
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly change: DraftChange;
}

@Component({
  selector: 'forge-addition-picker',
  imports: [AdditionPreview, Icon],
  templateUrl: './addition-picker.html',
  styleUrl: './addition-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdditionPicker {
  readonly additions = input.required<readonly MapAddition[]>();
  readonly environment = input.required<'dungeon' | 'forest'>();
  readonly disabled = input(false);
  readonly changed = output<DraftChange>();
  protected readonly query = signal('');
  protected readonly selectedCount = computed(
    () => this.additions().filter((item) => item.checked).length,
  );
  protected readonly matches = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.additions().filter((item) =>
      `${item.label} ${item.description}`.toLowerCase().includes(query),
    );
  });
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  show(): void {
    if (this.disabled() || this.dialog().nativeElement.open) return;
    this.query.set('');
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected search(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.query.set(event.target.value);
  }

  protected clearSearch(searchInput: HTMLInputElement): void {
    this.query.set('');
    searchInput.focus();
  }
}
