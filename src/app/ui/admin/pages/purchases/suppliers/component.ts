import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Supplier } from '../../../../../models/supplier.model';
import { SupplierService } from '../../../../../services/supplier/supplier.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { ModalShellComponent } from '../../../../shared/modal-shell.component';

@Component({
  selector: 'app-purchases-suppliers',
  imports: [ModalShellComponent, ReactiveFormsModule, RouterLink, ConfirmDeleteModalComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchasesSuppliersComponent {
  private readonly supplierService = inject(SupplierService);
  private readonly fb = inject(FormBuilder);

  readonly suppliers = signal<Supplier[]>([]);
  readonly loading = signal(true);

  readonly formState = signal<null | 'create' | Supplier>(null);
  readonly editing = computed<Supplier | null>(() => {
    const s = this.formState();
    return s && s !== 'create' ? s : null;
  });
  readonly showForm = computed(() => this.formState() !== null);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly deleting = signal<Supplier | null>(null);
  readonly deletingSubmitting = signal(false);
  readonly deletingError = signal<string | null>(null);

  readonly deletingInitials = computed(() => {
    const s = this.deleting();
    if (!s) return null;
    const parts = s.name.trim().split(/\s+/).filter(Boolean);
    return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
  });

  readonly form = this.fb.nonNullable.group({
    name:    ['', [Validators.required, Validators.minLength(2)]],
    contact: [''],
    phone:   [''],
    email:   ['', [Validators.email]],
    notes:   [''],
  });

  constructor() {
    void this.refresh();
  }

  private nullIfEmpty(v: string): string | null {
    return v.trim() || null;
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.suppliers.set(await this.supplierService.listSuppliers());
    } catch (err: unknown) {
      console.error('Error cargando proveedores', err);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.form.reset({ name: '', contact: '', phone: '', email: '', notes: '' });
    this.formState.set('create');
    this.formError.set(null);
  }

  openEdit(s: Supplier): void {
    this.form.reset({
      name:    s.name,
      contact: s.contact ?? '',
      phone:   s.phone ?? '',
      email:   s.email ?? '',
      notes:   s.notes ?? '',
    });
    this.formState.set(s);
    this.formError.set(null);
  }

  closeForm(): void {
    this.formState.set(null);
    this.formError.set(null);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.formError.set(null);
    const raw = this.form.getRawValue();
    const input = {
      name:    raw.name.trim(),
      contact: this.nullIfEmpty(raw.contact),
      phone:   this.nullIfEmpty(raw.phone),
      email:   this.nullIfEmpty(raw.email),
      notes:   this.nullIfEmpty(raw.notes),
    };
    const editing = this.editing();
    try {
      if (editing) {
        await this.supplierService.updateSupplier(editing.id, input);
      } else {
        await this.supplierService.createSupplier(input);
      }
      this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(errorMessage(err, 'Error al guardar proveedor'));
    } finally {
      this.submitting.set(false);
    }
  }

  handleDelete(s: Supplier): void {
    this.deleting.set(s);
    this.deletingError.set(null);
  }

  cancelDelete(): void {
    if (this.deletingSubmitting()) return;
    this.deleting.set(null);
    this.deletingError.set(null);
  }

  async confirmDelete(): Promise<void> {
    const s = this.deleting();
    if (!s) return;
    this.deletingSubmitting.set(true);
    this.deletingError.set(null);
    try {
      await this.supplierService.deleteSupplier(s.id);
      if (this.editing()?.id === s.id) this.formState.set(null);
      this.deleting.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.deletingError.set(errorMessage(err, 'Error al eliminar proveedor'));
    } finally {
      this.deletingSubmitting.set(false);
    }
  }
}
