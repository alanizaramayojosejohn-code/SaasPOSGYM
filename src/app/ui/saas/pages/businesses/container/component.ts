import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Business } from '../../../../../models/business.model';
import { BusinessService } from '../../../../../services/business/business.service';
import { BusinessQueryService } from '../../../../../services/business/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { BusinessesFormComponent, BusinessFormValue } from '../components/form/form';
import { BusinessesListComponent } from '../components/list/list';

@Component({
  selector: 'app-saas-businesses',
  imports: [BusinessesListComponent, BusinessesFormComponent],
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

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

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

  async handleDelete(business: Business): Promise<void> {
    const ok = window.confirm(
      `⚠️ BORRAR NEGOCIO "${business.name}"\n\n` +
      `Esto borra TODO en cascada: usuarios, clientes, productos, planes, ventas, ` +
      `membresías y asistencias. NO se puede deshacer.\n\n` +
      `¿Continuar?`,
    );
    if (!ok) return;
    try {
      await this.businessService.deleteBusiness(business.id);
      if (this.editing()?.id === business.id) this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      window.alert(errorMessage(err, 'Error al borrar negocio'));
    }
  }
}
