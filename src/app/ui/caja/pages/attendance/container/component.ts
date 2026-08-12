import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActiveMembership } from '../../../../../models/active-membership.model';
import { initials } from '../../../../../utilities/initials';
import { AttendanceWithDetails } from '../../../../../models/attendance.model';
import { Client } from '../../../../../models/client.model';
import { ClientMembershipSummary } from '../../../../../models/client-membership.model';
import { MembershipPlanWithServices } from '../../../../../models/membership-plan.model';
import { AttendanceService } from '../../../../../services/attendance/attendance.service';
import { AttendanceQueryService } from '../../../../../services/attendance/query.service';
import { ClientService, CreateClientInput } from '../../../../../services/client/client.service';
import { ClientQueryService } from '../../../../../services/client/query.service';
import { MembershipPlanQueryService } from '../../../../../services/membership-plan/query.service';
import { OrderService } from '../../../../../services/order/order.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ClientsFormComponent } from '../../../../admin/pages/clients/components/form/form';
import { ModalShellComponent } from '../../../../shared/modal-shell.component';
import { AttendanceListComponent } from '../components/list/list';

type PaymentMethod = 'cash' | 'card' | 'qr';
type LookupState = 'idle' | 'found' | 'not_found';

@Component({
  selector: 'app-caja-attendance',
  imports: [DatePipe, DecimalPipe, AttendanceListComponent, ModalShellComponent, ClientsFormComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CajaAttendanceContainerComponent {
  private readonly attendanceService = inject(AttendanceService);
  private readonly attendanceQuery = inject(AttendanceQueryService);
  private readonly clientService = inject(ClientService);
  private readonly clientQuery = inject(ClientQueryService);
  private readonly planQuery = inject(MembershipPlanQueryService);
  private readonly orderService = inject(OrderService);

  readonly attendance = signal<AttendanceWithDetails[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly plans = signal<MembershipPlanWithServices[]>([]);
  readonly loading = signal(false);

  // ---------------------------------------------------------- Búsqueda por CI
  readonly ciInput = signal('');
  readonly lookup = signal<LookupState>('idle');
  readonly searchedCi = signal('');
  readonly foundClient = signal<Client | null>(null);

  readonly membershipLoading = signal(false);
  readonly activeMembership = signal<ActiveMembership | null>(null);
  readonly lastMembership = signal<ClientMembershipSummary | null>(null);

  readonly successMessage = signal<string | null>(null);

  // ------------------------------------------------------ Registrar membresía
  readonly selectedPlanId = signal('');
  readonly membershipPaymentMethod = signal<PaymentMethod>('cash');
  readonly membershipSubmitting = signal(false);
  readonly membershipError = signal<string | null>(null);

  readonly selectedPlan = computed<MembershipPlanWithServices | null>(() => {
    const id = this.selectedPlanId();
    return this.plans().find((p) => p.id === id) ?? null;
  });

  // --------------------------------------------------------- Marcar asistencia
  readonly markingSubmitting = signal(false);
  readonly markingError = signal<string | null>(null);

  // -------------------------------------------------------- Alta rápida cliente
  readonly clientModalOpen = signal(false);
  readonly clientSubmitting = signal(false);
  readonly clientError = signal<string | null>(null);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [attendance, clients, plans] = await Promise.all([
        this.attendanceQuery.listRecent(),
        this.clientQuery.listClients(),
        this.planQuery.listPlans(),
      ]);
      this.attendance.set(attendance);
      this.clients.set(clients);
      this.plans.set(plans);
    } catch (err: unknown) {
      console.error('Error cargando asistencia', err);
    } finally {
      this.loading.set(false);
    }
  }

  setCi(value: string): void {
    this.ciInput.set(value);
  }

  search(): void {
    const ci = this.ciInput().trim();
    if (!ci) return;
    this.successMessage.set(null);
    this.markingError.set(null);
    this.searchedCi.set(ci);

    const match = this.clients().find((c) => c.ci.trim().toLowerCase() === ci.toLowerCase());
    if (!match) {
      this.lookup.set('not_found');
      this.foundClient.set(null);
      return;
    }
    this.selectClient(match);
  }

  private selectClient(client: Client): void {
    this.foundClient.set(client);
    this.lookup.set('found');
    this.ciInput.set(client.ci);
    void this.loadMembershipInfo(client.id);
  }

  async loadMembershipInfo(clientId: string): Promise<void> {
    this.membershipLoading.set(true);
    this.selectedPlanId.set('');
    this.membershipError.set(null);
    try {
      const [active, last] = await Promise.all([
        this.attendanceQuery.activeMembershipByClient(clientId),
        this.attendanceQuery.lastMembershipByClient(clientId),
      ]);
      this.activeMembership.set(active);
      this.lastMembership.set(last);
    } catch (err: unknown) {
      console.error('Error cargando membresías del cliente', err);
    } finally {
      this.membershipLoading.set(false);
    }
  }

  // Vuelve al estado inicial para buscar el siguiente CI.
  resetLookup(): void {
    this.ciInput.set('');
    this.searchedCi.set('');
    this.lookup.set('idle');
    this.foundClient.set(null);
    this.activeMembership.set(null);
    this.lastMembership.set(null);
    this.membershipError.set(null);
    this.markingError.set(null);
  }

  setMembershipPaymentMethod(m: PaymentMethod): void {
    this.membershipPaymentMethod.set(m);
  }

  selectPlan(id: string): void {
    this.selectedPlanId.set(id);
  }

  async registerMembership(): Promise<void> {
    const client = this.foundClient();
    const planId = this.selectedPlanId();
    if (!client || !planId || this.membershipSubmitting()) return;

    this.membershipSubmitting.set(true);
    this.membershipError.set(null);
    try {
      await this.orderService.registerOrder({
        client_id: client.id,
        payment_method: this.membershipPaymentMethod(),
        items: [{ type: 'membership', plan_id: planId, start_date: null }],
      });
      await this.loadMembershipInfo(client.id);
      this.successMessage.set(`Membresía registrada para ${client.name}.`);
    } catch (err: unknown) {
      this.membershipError.set(errorMessage(err, 'Error al registrar membresía'));
    } finally {
      this.membershipSubmitting.set(false);
    }
  }

  async markAttendance(): Promise<void> {
    const client = this.foundClient();
    if (!client || this.markingSubmitting()) return;

    this.markingSubmitting.set(true);
    this.markingError.set(null);
    try {
      await this.attendanceService.registerAttendance(client.id);
      this.successMessage.set(`Asistencia registrada para ${client.name}.`);
      await this.refresh();
      this.resetLookup();
    } catch (err: unknown) {
      this.markingError.set(errorMessage(err, 'Error al registrar asistencia'));
    } finally {
      this.markingSubmitting.set(false);
    }
  }

  openClientModal(): void {
    this.clientModalOpen.set(true);
    this.clientError.set(null);
  }

  closeClientModal(): void {
    if (this.clientSubmitting()) return;
    this.clientModalOpen.set(false);
    this.clientError.set(null);
  }

  readonly initials = initials;

  async handleCreateClient(input: CreateClientInput): Promise<void> {
    this.clientSubmitting.set(true);
    this.clientError.set(null);
    try {
      const client = await this.clientService.createClient(input);
      this.clients.update((list) => [client, ...list]);
      this.clientModalOpen.set(false);
      this.selectClient(client);
    } catch (err: unknown) {
      this.clientError.set(errorMessage(err, 'Error al crear cliente'));
    } finally {
      this.clientSubmitting.set(false);
    }
  }
}
