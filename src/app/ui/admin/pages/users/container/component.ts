import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Profile } from '../../../../../models/profile.model';
import { ProfileService } from '../../../../../services/profile/profile.service';
import { ProfileQueryService } from '../../../../../services/profile/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { UserFormValue, UsersFormComponent } from '../components/form/form';
import { UsersListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-users',
  imports: [UsersListComponent, UsersFormComponent],
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

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

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

  async handleDelete(user: Profile): Promise<void> {
    const ok = window.confirm(
      `¿Borrar al usuario "${user.name}" (${user.role})?\n\n` +
      `Esto solo elimina el profile en SaasGym; la cuenta de auth.user en Supabase ` +
      `queda existente pero ya no podrá entrar (invite-only). ` +
      `Para eliminarla por completo hay que borrarla en Supabase Dashboard → Authentication → Users.`,
    );
    if (!ok) return;
    try {
      await this.profileService.deleteProfile(user.id);
      if (this.editing()?.id === user.id) this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      window.alert(errorMessage(err, 'Error al borrar usuario'));
    }
  }
}
