import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MembershipPlanWithServices } from '../../../../../models/membership-plan.model';
import { Service } from '../../../../../models/service.model';
import { CreateMembershipPlanInput, MembershipPlanService } from '../../../../../services/membership-plan/membership-plan.service';
import { MembershipPlanQueryService } from '../../../../../services/membership-plan/query.service';
import { ServiceQueryService } from '../../../../../services/service/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { MembershipPlansFormComponent } from '../components/form/form';
import { MembershipPlansListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-membership-plans',
  imports: [MembershipPlansListComponent, MembershipPlansFormComponent],
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

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

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

  async handleDelete(plan: MembershipPlanWithServices): Promise<void> {
    const ok = window.confirm(
      `¿Borrar el plan "${plan.name}"?\n` +
      `No se puede deshacer. Si hay socios con este plan asignado, la operación fallará.`,
    );
    if (!ok) return;
    try {
      await this.planService.deletePlan(plan.id);
      if (this.editing()?.id === plan.id) this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      window.alert(errorMessage(err, 'Error al borrar plan'));
    }
  }
}
