import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Profile } from '../../../../../models/profile.model';
import { ProfileService } from '../../../../../services/profile/profile.service';
import { ProfileQueryService } from '../../../../../services/profile/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { ModalShellComponent } from '../../../../shared/modal-shell.component';
import { UsersDetailComponent } from '../components/detail/detail';
import { UserFormValue, UsersFormComponent } from '../components/form/form';
import { UsersListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-users',
  imports: [
    ModalShellComponent,
    UsersListComponent,
    UsersFormComponent,
    UsersDetailComponent,
    ConfirmDeleteModalComponent,
  ],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersContainerComponent {
  private readonly profileService = inject(ProfileService);
  private readonly profileQuery = inject(ProfileQueryService);

  readonly users = signal<Profile[]>([]);
  readonly loading = signal(false);

  readonly formState = signal<null | 'create' | Profile>(null);
  readonly editing = computed<Profile | null>(() => {
    const s = this.formState();
    return s && s !== 'create' ? s : null;
  });
  readonly showForm = computed(() => this.formState() !== null);

  // Modal de detalle (solo lectura), independiente del form.
  readonly viewing = signal<Profile | null>(null);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  // Modal de borrado. Type-to-confirm porque elimina acceso al panel.
  readonly deleting = signal<Profile | null>(null);
  readonly deletingError = signal<string | null>(null);
  readonly deletingSubmitting = signal(false);

  readonly deletingInitials = computed(() => {
    const u = this.deleting();
    if (!u) return null;
    const parts = u.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });

  readonly deletingSublabel = computed(() => {
    const u = this.deleting();
    if (!u) return null;
    const role = u.role === 'admin' ? 'Administrador' : u.role === 'caja' ? 'Cajero' : 'Super admin';
    return `${role} · CI ${u.ci}`;
  });

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.users.set(await this.profileQuery.listBusinessUsers());
    } catch (err: unknown) {
      console.error('Error listando usuarios', err);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.formState.set('create');
    this.formError.set(null);
  }

  openEdit(user: Profile): void {
    this.formState.set(user);
    this.formError.set(null);
  }

  closeForm(): void {
    this.formState.set(null);
    this.formError.set(null);
  }

  openView(user: Profile): void {
    this.viewing.set(user);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  // Pasa del detalle al form de edición para el mismo colaborador.
  editFromView(): void {
    const user = this.viewing();
    this.viewing.set(null);
    if (user) this.openEdit(user);
  }

  async handleSubmit(input: UserFormValue): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    const editing = this.editing();
    try {
      if (editing) {
        await this.profileService.updateProfile(editing.id, {
          name: input.name,
          ci: input.ci,
          role: input.role,
        });
      } else {
        await this.profileService.createUserForBusiness({
          email: input.email,
          password: input.password,
          name: input.name,
          ci: input.ci,
          role: input.role,
        });
      }
      this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(
        errorMessage(err, editing ? 'Error al guardar usuario' : 'Error al crear usuario'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  handleDelete(user: Profile): void {
    this.deleting.set(user);
    this.deletingError.set(null);
  }

  cancelDelete(): void {
    if (this.deletingSubmitting()) return;
    this.deleting.set(null);
    this.deletingError.set(null);
  }

  async confirmDelete(): Promise<void> {
    const user = this.deleting();
    if (!user) return;
    this.deletingSubmitting.set(true);
    this.deletingError.set(null);
    try {
      await this.profileService.deleteProfile(user.id);
      if (this.editing()?.id === user.id) this.formState.set(null);
      this.deleting.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.deletingError.set(errorMessage(err, 'Error al borrar usuario'));
    } finally {
      this.deletingSubmitting.set(false);
    }
  }
}
