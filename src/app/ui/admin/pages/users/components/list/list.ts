import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Profile } from '../../../../../../models/profile.model';
import { initials } from '../../../../../../utilities/initials';

type UserFilter = 'all' | 'admin' | 'caja';
type UserSort = 'name' | 'ci' | 'created';

@Component({
  selector: 'app-admin-users-list',
  imports: [DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersListComponent {
  readonly users = input.required<Profile[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<Profile>();
  readonly remove = output<Profile>();
  readonly view = output<Profile>();

  readonly search = signal('');
  readonly filter = signal<UserFilter>('all');
  readonly sort = signal<UserSort>('created');
  readonly sortMenuOpen = signal(false);

  readonly initials = initials;

  readonly counts = computed(() => {
    const list = this.users();
    return {
      all: list.length,
      admin: list.filter((u) => u.role === 'admin').length,
      caja: list.filter((u) => u.role === 'caja').length,
    };
  });

  readonly filteredSorted = computed<Profile[]>(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    const s = this.sort();
    let list = this.users().slice();

    if (f === 'admin') list = list.filter((u) => u.role === 'admin');
    else if (f === 'caja') list = list.filter((u) => u.role === 'caja');

    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.ci.toLowerCase().includes(q),
      );
    }

    if (s === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (s === 'ci') list.sort((a, b) => a.ci.localeCompare(b.ci));
    else list.sort((a, b) => b.created_at.localeCompare(a.created_at));

    return list;
  });

  readonly sortLabel = computed(() => {
    switch (this.sort()) {
      case 'name': return 'Nombre A→Z';
      case 'ci': return 'CI ascendente';
      default: return 'Recientes primero';
    }
  });

  setSearch(v: string): void { this.search.set(v); }
  setFilter(f: UserFilter): void { this.filter.set(f); }
  setSort(s: UserSort): void {
    this.sort.set(s);
    this.sortMenuOpen.set(false);
  }
  toggleSortMenu(): void { this.sortMenuOpen.update((v) => !v); }
}
