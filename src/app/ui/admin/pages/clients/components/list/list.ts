import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Client } from '../../../../../../models/client.model';
import { initials } from '../../../../../../utilities/initials';

// Tabs del listado: filtran sobre el array completo en memoria.
type ClientFilter = 'all' | 'recent' | 'with-nit' | 'no-nit' | 'inactive';
type ClientSort = 'name' | 'ci' | 'created';

@Component({
  selector: 'app-admin-clients-list',
  imports: [DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsListComponent {
  readonly clients = input.required<Client[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<Client>();
  readonly remove = output<Client>();
  readonly view = output<Client>();
  readonly toggleActive = output<Client>();

  readonly search = signal('');
  readonly filter = signal<ClientFilter>('all');
  readonly sort = signal<ClientSort>('created');
  readonly sortMenuOpen = signal(false);

  // Iniciales del avatar: 2 chars del nombre.
  readonly initials = initials;

  // Recientes = creados en últimos 30 días.
  private readonly thirtyDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  })();

  readonly counts = computed(() => {
    const list = this.clients();
    return {
      all: list.length,
      recent: list.filter((c) => c.created_at >= this.thirtyDaysAgo).length,
      withNit: list.filter((c) => !!c.nit).length,
      noNit: list.filter((c) => !c.nit).length,
      inactive: list.filter((c) => !c.is_active).length,
    };
  });

  readonly filteredSorted = computed<Client[]>(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    const s = this.sort();
    let list = this.clients().slice();

    if (f === 'recent') list = list.filter((c) => c.created_at >= this.thirtyDaysAgo);
    else if (f === 'with-nit') list = list.filter((c) => !!c.nit);
    else if (f === 'no-nit') list = list.filter((c) => !c.nit);
    else if (f === 'inactive') list = list.filter((c) => !c.is_active);

    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.ci.toLowerCase().includes(q) ||
          (c.nit ?? '').toLowerCase().includes(q) ||
          (c.business_name ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q),
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
  setFilter(f: ClientFilter): void { this.filter.set(f); }
  setSort(s: ClientSort): void {
    this.sort.set(s);
    this.sortMenuOpen.set(false);
  }
  toggleSortMenu(): void { this.sortMenuOpen.update((v) => !v); }
}
