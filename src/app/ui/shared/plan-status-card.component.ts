import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanService } from '../../services/plan/plan.service';
import { STATUS_LABELS } from '../../models/plan.model';

// Franja compacta de estado del plan — plan actual, días restantes (con el
// mismo umbral de color que "socios por vencer": ≤3 días rojo, ≤7 ámbar) y
// badge de estado cuando no es 'active'. Los datos ya están cargados
// globalmente por PlanService (auth.service los pide en cada login), así
// que este componente no dispara ninguna consulta propia.
@Component({
  selector: 'app-plan-status-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (plans.usage(); as u) {
      <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface backdrop-blur-xl border border-border-subtle text-xs flex-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-foreground-faint flex-shrink-0">
          <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
        </svg>
        <span class="font-semibold text-foreground">Plan {{ u.plan_name }}</span>
        @if (daysLeftLabel(); as label) {
          <span class="text-foreground-faint">·</span>
          <span [class]="daysLeftClass()">{{ label }}</span>
        }
        @if (u.subscription_status !== 'active') {
          <span class="px-2 py-0.5 rounded-full font-semibold" [class]="statusBadgeClass()">
            {{ statusLabels[u.subscription_status] }}
          </span>
        }
        <a routerLink="/admin/plan" class="ml-auto font-semibold text-foreground-muted hover:text-foreground flex-shrink-0">
          Gestionar →
        </a>
      </div>
    }
  `,
})
export class PlanStatusCardComponent {
  protected readonly plans = inject(PlanService);
  protected readonly statusLabels = STATUS_LABELS;

  readonly daysLeftLabel = computed(() => {
    const days = this.plans.usage()?.days_left ?? null;
    if (days === null) return null;
    if (days < 0) return `Venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
    if (days === 0) return 'Vence hoy';
    return `Vence en ${days} día${days === 1 ? '' : 's'}`;
  });

  readonly daysLeftClass = computed(() => {
    const days = this.plans.usage()?.days_left ?? null;
    if (days === null) return 'text-foreground-muted font-semibold';
    if (days <= 3) return 'text-danger font-semibold';
    if (days <= 7) return 'text-warning font-semibold';
    return 'text-foreground-muted font-semibold';
  });

  readonly statusBadgeClass = computed(() => {
    const status = this.plans.usage()?.subscription_status;
    if (status === 'suspended' || status === 'cancelled') return 'bg-danger/10 text-danger';
    if (status === 'past_due') return 'bg-danger/10 text-danger';
    if (status === 'trialing') return 'bg-warning/10 text-warning';
    return 'bg-muted text-foreground-muted';
  });
}
