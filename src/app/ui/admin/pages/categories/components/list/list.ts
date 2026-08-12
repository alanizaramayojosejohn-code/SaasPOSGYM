import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Category } from '../../../../../../models/category.model';
import { initials } from '../../../../../../utilities/initials';

@Component({
  selector: 'app-admin-categories-list',
  templateUrl: './list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesListComponent {
  readonly categories = input.required<Category[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<Category>();
  readonly remove = output<Category>();

  readonly search = signal('');

  readonly initials = initials;

  readonly filtered = computed<Category[]>(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.categories().slice();
    return this.categories().filter((c) => c.name.toLowerCase().includes(q));
  });

  setSearch(v: string): void { this.search.set(v); }
}
