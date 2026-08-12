import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Business } from '../../../../../../models/business.model';
import { initials } from '../../../../../../utilities/initials';

type BusinessFilter = 'all' | 'gym' | 'pos';
type BusinessSort = 'name' | 'created';

@Component({
  selector: 'app-saas-businesses-list',
  imports: [DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessesListComponent {
  readonly businesses = input.required<Business[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<Business>();
  readonly remove = output<Business>();
  readonly view = output<Business>();

  readonly search = signal('');
  readonly filter = signal<BusinessFilter>('all');
  readonly sort = signal<BusinessSort>('created');
  readonly sortMenuOpen = signal(false);

  readonly initials = initials;

  readonly counts = computed(() => {
    const list = this.businesses();
    return {
      all: list.length,
      gym: list.filter((b) => b.type === 'gym').length,
      pos: list.filter((b) => b.type === 'pos').length,
    };
  });

  readonly filteredSorted = computed<Business[]>(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    const s = this.sort();
    let list = this.businesses().slice();

    if (f === 'gym') list = list.filter((b) => b.type === 'gym');
    else if (f === 'pos') list = list.filter((b) => b.type === 'pos');

    if (q) list = list.filter((b) => b.name.toLowerCase().includes(q));

    if (s === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => b.created_at.localeCompare(a.created_at));

    return list;
  });

  readonly sortLabel = computed(() => {
    switch (this.sort()) {
      case 'name': return 'Nombre A→Z';
      default: return 'Recientes primero';
    }
  });

  setSearch(v: string): void { this.search.set(v); }
  setFilter(f: BusinessFilter): void { this.filter.set(f); }
  setSort(s: BusinessSort): void {
    this.sort.set(s);
    this.sortMenuOpen.set(false);
  }
  toggleSortMenu(): void { this.sortMenuOpen.update((v) => !v); }
}
