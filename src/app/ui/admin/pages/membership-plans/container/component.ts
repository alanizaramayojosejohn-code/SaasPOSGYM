import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MembershipPlanWithServices } from '../../../../../models/membership-plan.model';
import { Service } from '../../../../../models/service.model';
import { CreateMembershipPlanInput, MembershipPlanService } from '../../../../../services/membership-plan/membership-plan.service';
import { MembershipPlanQueryService } from '../../../../../services/membership-plan/query.service';
import { ServiceQueryService } from '../../../../../services/service/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { ModalShellComponent } from '../../../../shared/modal-shell.component';
import { MembershipPlansDetailComponent } from '../components/detail/detail';
import { MembershipPlansFormComponent } from '../components/form/form';
import { MembershipPlansListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-membership-plans',
  imports: [
    ModalShellComponent,
    MembershipPlansListComponent,
    MembershipPlansFormComponent,
    MembershipPlansDetailComponent,
    ConfirmDeleteModalComponent,
  ],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMembershipPlansContainerComponent {
  private readonly planService = inject(MembershipPlanService);
  private readonly planQuery = inject(MembershipPlanQueryService);
  private readonly serviceQuery = inject(ServiceQueryService);

  readonly plans = signal<MembershipPlanWithServices[]>([]);
  readonly services = signal<Service[]>([]);
  readonly loading = signal(false);

  readonly formState = signal<null | 'create' | MembershipPlanWithServices>(null);
  readonly editing = computed<MembershipPlanWithServices | null>(() => {
    const s = this.formState();
    return s && s !== 'create' ? s : null;
  });
  readonly showForm = computed(() => this.formState() !== null);

  // Modal de detalle (solo lectura), independiente del form.
  readonly viewing = signal<MembershipPlanWithServices | null>(null);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  // Modal de borrado. Borrado hard, pero la UX no requiere type-to-confirm
  // porque la RPC bloquea si hay socios activos con el plan.
  readonly deleting = signal<MembershipPlanWithServices | null>(null);
  readonly deletingError = signal<string | null>(null);
  readonly deletingSubmitting = signal(false);

  readonly deletingInitials = computed(() => {
    const p = this.deleting();
    if (!p) return null;
    const parts = p.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });

  readonly deletingPrice = computed(() => {
    const p = this.deleting();
    if (!p) return null;
    return `Bs ${Number(p.price).toFixed(2)}`;
  });

  readonly deletingSublabel = computed(() => {
    const p = this.deleting();
    if (!p) return null;
    const parts: string[] = [`${p.duration_days} días`];
    if (p.sessions_number != null) parts.push(`${p.sessions_number} sesiones`);
    parts.push(p.type === 'promo' ? 'Promo' : 'Normal');
    return parts.join(' · ');
  });

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [plans, services] = await Promise.all([
        this.planQuery.listPlans(),
        this.serviceQuery.listServices(),
      ]);
      this.plans.set(plans);
      this.services.set(services);
    } catch (err: unknown) {
      console.error('Error listando planes', err);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.formState.set('create');
    this.formError.set(null);
  }

  openEdit(plan: MembershipPlanWithServices): void {
    this.formState.set(plan);
    this.formError.set(null);
  }

  closeForm(): void {
    this.formState.set(null);
    this.formError.set(null);
  }

  openView(plan: MembershipPlanWithServices): void {
    this.viewing.set(plan);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  // Pasa del detalle al form de edición para el mismo plan.
  editFromView(): void {
    const plan = this.viewing();
    this.viewing.set(null);
    if (plan) this.openEdit(plan);
  }

  async handleSubmit(input: CreateMembershipPlanInput): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    const editing = this.editing();
    try {
      if (editing) {
        await this.planService.updatePlan(editing.id, input);
      } else {
        await this.planService.createPlan(input);
      }
      this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(
        errorMessage(err, editing ? 'Error al guardar plan' : 'Error al crear plan'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  handleDelete(plan: MembershipPlanWithServices): void {
    this.deleting.set(plan);
    this.deletingError.set(null);
  }

  cancelDelete(): void {
    if (this.deletingSubmitting()) return;
    this.deleting.set(null);
    this.deletingError.set(null);
  }

  async confirmDelete(): Promise<void> {
    const plan = this.deleting();
    if (!plan) return;
    this.deletingSubmitting.set(true);
    this.deletingError.set(null);
    try {
      await this.planService.deletePlan(plan.id);
      if (this.editing()?.id === plan.id) this.formState.set(null);
      this.deleting.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.deletingError.set(errorMessage(err, 'Error al borrar plan'));
    } finally {
      this.deletingSubmitting.set(false);
    }
  }
}
