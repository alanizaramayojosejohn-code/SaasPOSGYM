import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Client } from '../../../../../models/client.model';
import { ClientService, CreateClientInput } from '../../../../../services/client/client.service';
import { ClientQueryService } from '../../../../../services/client/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ClientsFormComponent } from '../components/form/form';
import { ClientsListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-clients',
  imports: [ClientsListComponent, ClientsFormComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminClientsContainerComponent {
  private readonly clientService = inject(ClientService);
  private readonly clientQuery = inject(ClientQueryService);

  readonly clients = signal<Client[]>([]);
  readonly loading = signal(false);

  // Modo del form: null = oculto, 'create' = nuevo, Client = editando ese cliente.
  readonly formState = signal<null | 'create' | Client>(null);
  readonly editing = computed<Client | null>(() => {
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
      this.clients.set(await this.clientQuery.listClients());
    } catch (err: unknown) {
      console.error('Error listando clientes', err);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.formState.set('create');
    this.formError.set(null);
  }

  openEdit(client: Client): void {
    this.formState.set(client);
    this.formError.set(null);
  }

  closeForm(): void {
    this.formState.set(null);
    this.formError.set(null);
  }

  async handleSubmit(input: CreateClientInput): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    const editing = this.editing();
    try {
      if (editing) {
        await this.clientService.updateClient(editing.id, input);
      } else {
        await this.clientService.createClient(input);
      }
      this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(
        errorMessage(err, editing ? 'Error al guardar cliente' : 'Error al crear cliente'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  async handleDelete(client: Client): Promise<void> {
    const ok = window.confirm(
      `¿Borrar al cliente "${client.name}" (CI ${client.ci})?\n` +
      `No se puede deshacer. Si tiene membresías asignadas, la operación fallará.`,
    );
    if (!ok) return;
    try {
      await this.clientService.deleteClient(client.id);
      // Si estaba siendo editado, cierra el form.
      if (this.editing()?.id === client.id) this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      window.alert(errorMessage(err, 'Error al borrar cliente'));
    }
  }
}
