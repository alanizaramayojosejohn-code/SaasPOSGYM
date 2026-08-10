import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Category } from '../../../../../models/category.model';
import { CategoryService, CreateCategoryInput } from '../../../../../services/category/category.service';
import { CategoryQueryService } from '../../../../../services/category/query.service';
import { errorMessage } from '../../../../../utilities/error-message';
import { ConfirmDeleteModalComponent } from '../../../../shared/confirm-delete-modal.component';
import { ModalShellComponent } from '../../../../shared/modal-shell.component';
import { CategoriesFormComponent } from '../components/form/form';
import { CategoriesListComponent } from '../components/list/list';

@Component({
  selector: 'app-admin-categories',
  imports: [ModalShellComponent, CategoriesListComponent, CategoriesFormComponent, ConfirmDeleteModalComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCategoriesContainerComponent {
  private readonly categoryService = inject(CategoryService);
  private readonly categoryQuery = inject(CategoryQueryService);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);

  readonly formState = signal<null | 'create' | Category>(null);
  readonly editing = computed<Category | null>(() => {
    const s = this.formState();
    return s && s !== 'create' ? s : null;
  });
  readonly showForm = computed(() => this.formState() !== null);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly deleting = signal<Category | null>(null);
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
      this.categories.set(await this.categoryQuery.listCategories());
    } catch (err: unknown) {
      console.error('Error listando categorías', err);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.formState.set('create');
    this.formError.set(null);
  }

  openEdit(category: Category): void {
    this.formState.set(category);
    this.formError.set(null);
  }

  closeForm(): void {
    this.formState.set(null);
    this.formError.set(null);
  }

  async handleSubmit(input: CreateCategoryInput): Promise<void> {
    this.submitting.set(true);
    this.formError.set(null);
    const editing = this.editing();
    try {
      if (editing) {
        await this.categoryService.updateCategory(editing.id, input);
      } else {
        await this.categoryService.createCategory(input);
      }
      this.formState.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.formError.set(
        errorMessage(err, editing ? 'Error al guardar categoría' : 'Error al crear categoría'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  handleDelete(category: Category): void {
    this.deleting.set(category);
    this.deletingError.set(null);
  }

  cancelDelete(): void {
    if (this.deletingSubmitting()) return;
    this.deleting.set(null);
    this.deletingError.set(null);
  }

  async confirmDelete(): Promise<void> {
    const category = this.deleting();
    if (!category) return;
    this.deletingSubmitting.set(true);
    this.deletingError.set(null);
    try {
      await this.categoryService.deleteCategory(category.id);
      if (this.editing()?.id === category.id) this.formState.set(null);
      this.deleting.set(null);
      await this.refresh();
    } catch (err: unknown) {
      this.deletingError.set(errorMessage(err, 'Error al eliminar categoría'));
    } finally {
      this.deletingSubmitting.set(false);
    }
  }
}
