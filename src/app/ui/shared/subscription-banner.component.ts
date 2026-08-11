import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanService } from '../../services/plan/plan.service';

// Aviso de estado de la suscripción, arriba del contenido de la shell.
//
// Solo aparece cuando hay algo que hacer: prueba o período por vencer dentro de
// 7 días, o sistema en solo lectura. Un cartel permanente se vuelve invisible a
// los dos días y deja de servir justo cuando hace falta.
@Component({
  selector: 'app-subscription-banner',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (plans.isReadOnly()) {
      <div class="a-rise-sm mx-auto max-w-7xl px-6 pt-5">
        <div class="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-danger flex-shrink-0 mt-0.5">
            <path d="M12 9v4"/><path d="M12 17h.01"/>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-danger">{{ readOnlyTitle() }}</p>
            <p class="text-xs text-foreground-muted mt-0.5">
              Puedes seguir consultando tu información y tus reportes, pero no registrar
              ventas ni cambios hasta regularizar el pago.
            </p>
          </div>
          <a routerLink="/admin/plan"
             class="press flex-shrink-0 px-3 py-1.5 text-xs font-bold bg-danger text-white rounded-lg hover:bg-danger/90 transition">
            Ver mi plan
          </a>
        </div>
      </div>
    } @else if (plans.showExpiryWarning()) {
      <div class="a-rise-sm mx-auto max-w-7xl px-6 pt-5">
        <div class="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-warning flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-warning">{{ warningTitle() }}</p>
            <p class="text-xs text-foreground-muted mt-0.5">
              Al vencer, el sistema pasa a solo lectura. Tu información no se borra.
            </p>
          </div>
          <a routerLink="/admin/plan"
             class="press flex-shrink-0 px-3 py-1.5 text-xs font-bold bg-warning text-white rounded-lg hover:bg-warning/90 transition">
            Renovar
          </a>
        </div>
      </div>
    }
  `,
})
export class SubscriptionBannerComponent {
  protected readonly plans = inject(PlanService);

  readonly readOnlyTitle = computed(() =>
    this.plans.status() === 'trialing'
      ? 'Tu período de prueba terminó'
      : 'Tu suscripción está vencida',
  );

  readonly warningTitle = computed(() => {
    const days = this.plans.daysLeft() ?? 0;
    const what = this.plans.isTrialing() ? 'Tu prueba' : 'Tu suscripción';
    if (days <= 0) return `${what} vence hoy`;
    if (days === 1) return `${what} vence mañana`;
    return `${what} vence en ${days} días`;
  });
}
