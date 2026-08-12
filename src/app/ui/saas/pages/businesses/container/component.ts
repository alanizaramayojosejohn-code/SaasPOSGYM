import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Business } from '../../../../../models/business.model';
import { BusinessService } from '../../../../../services/business/business.service';
import { BusinessQueryService } from '../../../../../services/business/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { ModalShellComponent } from '../../../../shared/modal-shell.component';
import { BusinessesDetailComponent } from '../components/detail/detail';
import { BusinessesFormComponent, BusinessFormValue } from '../components/form/form';
import { BusinessesListComponent } from '../components/list/list';

@Component({
  selector: 'app-saas-businesses',
  imports: [
    ModalShellComponent,
    BusinessesListComponent,
    BusinessesFormComponent,
    BusinessesDetailComponent,
    ConfirmDeleteModalComponent,
  ],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaasBusinessesContainerComponent {
  private readonly businessService = inject(BusinessService);
  private readonly businessQuery = inject(BusinessQueryService);

  readonly businesses = signal<Business[]>([]);
  readonly loading = signal(false);

  readonly formState = signal<null | 'create' | Business>(null);
  readonly editing = computed<Business | null>(() => {
    const s = this.formState();
    return s && s !== 'create' ? s : null;
  });
  readonly showForm = computed(() => this.formState() !== null);

  // Modal de detalle (solo lectura), independiente del form.
  readonly viewing = signal<Business | null>(null);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  // Modal de borrado. Type-to-confirm porque borra TODO en cascada.
  readonly deleting = signal<Business | null>(null);
  readonly deletingError = signal<string | null>(null);
  readonly deletingSubmitting = signal(false);

  readonly deletingInitials = computed(() => {
    const b = this.deleting();
    if (!b) return null;
    const parts = b.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });

  readonly deletingSublabel = computed(() => {
    const b = this.deleting();
    if (!b) return null;
    return b.type === 'gym' ? 'Gimnasio' : 'POS';
  });

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.businesses.set(await this.businessQuery.listBusinesses());
    } catch (err: unknown) {
      console.error('Error listando negocios', err);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.formState.set('create');
    this.formError.set(null);
  }

  openEdit(business: Business): void {
    this.formState.set(business);
    this.formError.set(null);
  }

  closeForm(): void {
    this.formState.set(null);
    this.formError.set(null);
  }

  openView(business: Business): void {
    this.viewing.set(business);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  // Pasa del detalle al form de edición para el mismo negocio.
  editFromView(): void {
    const business = this.viewing();
    this.viewing.set(null);
    if (business) this.openEdit(business);
  }

  async handleSubmit(input: BusinessFormValue): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    const editing = this.editing();
    try {
      if (editing) {
        await this.businessService.updateBusiness(editing.id, {
          name: input.businessName,
          type: input.businessType,
          theme: input.theme,
        });
      } else {
        await this.businessService.createBusinessWithAdmin({
          businessName: input.businessName,
          businessType: input.businessType,
          adminUserId: input.adminUserId,
          adminName: input.adminName,
          adminCi: input.adminCi,
          services: input.services,
          theme: input.theme,
        });
      }
      this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(
        errorMessage(err, editing ? 'Error al guardar negocio' : 'Error al crear negocio'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  handleDelete(business: Business): void {
    this.deleting.set(business);
    this.deletingError.set(null);
  }

  cancelDelete(): void {
    if (this.deletingSubmitting()) return;
    this.deleting.set(null);
    this.deletingError.set(null);
  }

  async confirmDelete(): Promise<void> {
    const business = this.deleting();
    if (!business) return;
    this.deletingSubmitting.set(true);
    this.deletingError.set(null);
    try {
      await this.businessService.deleteBusiness(business.id);
      if (this.editing()?.id === business.id) this.formState.set(null);
      this.deleting.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.deletingError.set(errorMessage(err, 'Error al borrar negocio'));
    } finally {
      this.deletingSubmitting.set(false);
    }
  }
}
