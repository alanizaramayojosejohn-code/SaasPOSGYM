import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Client } from '../../../../../models/client.model';
import { ClientService, CreateClientInput } from '../../../../../services/client/client.service';
import { ClientQueryService } from '../../../../../services/client/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { ModalShellComponent } from '../../../../shared/modal-shell.component';
import { ClientsFormComponent } from '../components/form/form';
import { ClientsListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-clients',
  imports: [ModalShellComponent, ClientsListComponent, ClientsFormComponent, ConfirmDeleteModalComponent],
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

  // Errores de acciones sobre la fila (activar/desactivar), fuera del formulario.
  readonly actionError = signal<string | null>(null);

  // Modal de borrado: null = cerrado, Client = mostrando confirmación para ese cliente.
  readonly deleting = signal<Client | null>(null);
  readonly deletingError = signal<string | null>(null);
  readonly deletingSubmitting = signal(false);

  readonly deletingInitials = computed(() => {
    const c = this.deleting();
    if (!c) return null;
    const parts = c.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });

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

  // Activa o desactiva desde la fila, con reversión si el servidor rechaza.
  async handleToggleActive(client: Client): Promise<void> {
    const next = !client.is_active;
    this.actionError.set(null);
    this.clients.update((list) =>
      list.map((c) => (c.id === client.id ? { ...c, is_active: next } : c)),
    );
    try {
      await this.clientService.setClientActive(client.id, next);
    } catch (err: unknown) {
      this.clients.update((list) =>
        list.map((c) => (c.id === client.id ? { ...c, is_active: client.is_active } : c)),
      );
      this.actionError.set(
        errorMessage(err, next ? 'Error al activar cliente' : 'Error al desactivar cliente'),
      );
    }
  }

  // Abre el modal de confirmación. El borrado real ocurre en confirmDelete().
  handleDelete(client: Client): void {
    this.deleting.set(client);
    this.deletingError.set(null);
  }

  cancelDelete(): void {
    if (this.deletingSubmitting()) return;
    this.deleting.set(null);
    this.deletingError.set(null);
  }

  async confirmDelete(): Promise<void> {
    const client = this.deleting();
    if (!client) return;
    this.deletingSubmitting.set(true);
    this.deletingError.set(null);
    try {
      await this.clientService.softDeleteClient(client.id);
      if (this.editing()?.id === client.id) this.formState.set(null);
      this.deleting.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.deletingError.set(errorMessage(err, 'Error al borrar cliente'));
    } finally {
      this.deletingSubmitting.set(false);
    }
  }
}
