import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AttendanceWithDetails } from '../../../../../models/attendance.model';
import { Client } from '../../../../../models/client.model';
import { AttendanceService } from '../../../../../services/attendance/attendance.service';
import { AttendanceQueryService } from '../../../../../services/attendance/query.service';
import { ClientQueryService } from '../../../../../services/client/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { AttendanceFormComponent } from '../components/form/form';
import { AttendanceListComponent } from '../components/list/list';

@Component({
  selector: 'app-caja-attendance',
  imports: [AttendanceFormComponent, AttendanceListComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CajaAttendanceContainerComponent {
  private readonly attendanceService = inject(AttendanceService);
  private readonly attendanceQuery = inject(AttendanceQueryService);
  private readonly clientQuery = inject(ClientQueryService);

  readonly attendance = signal<AttendanceWithDetails[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [attendance, clients] = await Promise.all([
        this.attendanceQuery.listRecent(),
        this.clientQuery.listClients(),
      ]);
      this.attendance.set(attendance);
      this.clients.set(clients);
    } catch (err: unknown) {
      console.error('Error cargando asistencia', err);
    } finally {
      this.loading.set(false);
    }
  }

  async handleRegister(clientId: string): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    this.successMessage.set(null);
    try {
      await this.attendanceService.registerAttendance(clientId);
      const client = this.clients().find((c) => c.id === clientId);
      this.successMessage.set(client ? `Asistencia registrada para ${client.name}.` : 'Asistencia registrada.');
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(errorMessage(err, 'Error al registrar asistencia'));
    } finally {
      this.submitting.set(false);
    }
  }
}
