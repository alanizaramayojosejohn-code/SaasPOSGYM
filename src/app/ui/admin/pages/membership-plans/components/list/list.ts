import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MembershipPlanWithServices } from '../../../../../../models/membership-plan.model';
import { initials } from '../../../../../../utilities/initials';

type PlanFilter = 'all' | 'normal' | 'promo' | 'unlimited';
type PlanSort = 'name' | 'price-asc' | 'price-desc' | 'duration' | 'created';

@Component({
  selector: 'app-admin-membership-plans-list',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembershipPlansListComponent {
  readonly plans = input.required<MembershipPlanWithServices[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<MembershipPlanWithServices>();
  readonly remove = output<MembershipPlanWithServices>();
  readonly view = output<MembershipPlanWithServices>();

  readonly search = signal('');
  readonly filter = signal<PlanFilter>('all');
  readonly sort = signal<PlanSort>('created');
  readonly sortMenuOpen = signal(false);

  readonly initials = initials;

  readonly counts = computed(() => {
    const list = this.plans();
    return {
      all: list.length,
      normal: list.filter((p) => p.type === 'normal').length,
      promo: list.filter((p) => p.type === 'promo').length,
      unlimited: list.filter((p) => p.sessions_number == null).length,
    };
  });

  readonly filteredSorted = computed<MembershipPlanWithServices[]>(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    const s = this.sort();
    let list = this.plans().slice();

    if (f === 'normal') list = list.filter((p) => p.type === 'normal');
    else if (f === 'promo') list = list.filter((p) => p.type === 'promo');
    else if (f === 'unlimited') list = list.filter((p) => p.sessions_number == null);

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.service_names.some((n) => n.toLowerCase().includes(q)),
      );
    }

    if (s === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (s === 'price-asc') list.sort((a, b) => Number(a.price) - Number(b.price));
    else if (s === 'price-desc') list.sort((a, b) => Number(b.price) - Number(a.price));
    else if (s === 'duration') list.sort((a, b) => a.duration_days - b.duration_days);
    else list.sort((a, b) => b.created_at.localeCompare(a.created_at));

    return list;
  });

  readonly sortLabel = computed(() => {
    switch (this.sort()) {
      case 'name': return 'Nombre A→Z';
      case 'price-asc': return 'Precio ascendente';
      case 'price-desc': return 'Precio descendente';
      case 'duration': return 'Duración ascendente';
      default: return 'Recientes primero';
    }
  });

  setSearch(v: string): void { this.search.set(v); }
  setFilter(f: PlanFilter): void { this.filter.set(f); }
  setSort(s: PlanSort): void {
    this.sort.set(s);
    this.sortMenuOpen.set(false);
  }
  toggleSortMenu(): void { this.sortMenuOpen.update((v) => !v); }
}
