import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import {
  ImageProcessorService,
  ImageValidationError,
  ProcessedImage,
  formatBytes,
} from '../../services/image/image-processor.service';

// Selector de imagen con vista previa, arrastrar y soltar, y compresión a WebP
// antes de subir. El componente NO sube nada: entrega el archivo ya procesado y
// el padre decide cuándo mandarlo, para que la imagen se suba junto con el
// resto del formulario y no antes de que el producto exista.
@Component({
  selector: 'app-image-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2">
      <label class="block text-sm font-medium text-foreground-muted">
        {{ label() }} <span class="text-foreground-faint">(opcional)</span>
      </label>

      <div
        class="relative border-2 border-dashed rounded-xl transition overflow-hidden"
        [class.border-primary]="dragging()"
        [class.bg-primary]="dragging()"
        [class.border-border-subtle]="!dragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        @if (previewUrl(); as url) {
          <!-- Vista previa -->
          <div class="flex items-center gap-4 p-3">
            <img
              [src]="url"
              alt="Vista previa"
              class="w-24 h-24 object-cover rounded-lg border border-border-subtle bg-muted flex-shrink-0 a-pop"
            />
            <div class="flex-1 min-w-0">
              @if (processed(); as p) {
                <p class="text-sm font-semibold text-foreground">Lista para subir</p>
                <p class="text-xs text-foreground-muted mt-0.5">
                  {{ p.width }}×{{ p.height }} px · WebP · {{ size(p.bytes) }}
                </p>
                <p class="text-[11px] text-success mt-0.5">
                  {{ savedLabel() }}
                </p>
              } @else {
                <p class="text-sm font-semibold text-foreground">Imagen actual</p>
                <p class="text-xs text-foreground-muted mt-0.5">Se conserva si no eliges otra.</p>
              }

              <div class="flex gap-2 mt-2">
                <button
                  type="button"
                  (click)="openPicker()"
                  [disabled]="busy() || disabled()"
                  class="press px-2.5 py-1 text-[11px] font-semibold text-foreground-muted border border-border-subtle rounded-md hover:bg-muted transition disabled:opacity-50"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  (click)="clear()"
                  [disabled]="busy() || disabled()"
                  class="press px-2.5 py-1 text-[11px] font-semibold text-danger/80 border border-danger/20 rounded-md hover:bg-danger/10 transition disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        } @else {
          <!-- Zona vacía -->
          <button
            type="button"
            (click)="openPicker()"
            [disabled]="busy() || disabled()"
            class="w-full px-4 py-7 flex flex-col items-center gap-2 text-center hover:bg-muted/40 transition disabled:opacity-50"
          >
            @if (busy()) {
              <svg class="spin text-foreground-muted" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span class="text-xs text-foreground-muted">Comprimiendo…</span>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-foreground-faint">
                <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span class="text-sm font-medium text-foreground-muted">
                Arrastra una imagen o haz clic
              </span>
              <span class="text-[11px] text-foreground-faint">
                PNG, JPG, WebP, GIF o AVIF · se convierte a WebP automáticamente
              </span>
            }
          </button>
        }

        <!-- El input real queda oculto; accept es solo comodidad del diálogo,
             la validación de verdad la hace el procesador leyendo los bytes. -->
        <input
          #fileInput
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          (change)="onFileSelected($event)"
          class="hidden"
        />
      </div>

      @if (error(); as msg) {
        <p class="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          {{ msg }}
        </p>
      }
    </div>
  `,
})
export class ImagePickerComponent {
  private readonly processor = inject(ImageProcessorService);

  readonly label = input<string>('Imagen');
  /** URL de la imagen ya guardada, en modo edición. */
  readonly currentUrl = input<string | null>(null);
  readonly disabled = input<boolean>(false);

  /** Archivo procesado, o null si el usuario quitó la imagen. */
  readonly changed = output<ProcessedImage | null>();
  /** Se emite cuando se pide quitar la imagen existente. */
  readonly removed = output<void>();

  readonly processed = signal<ProcessedImage | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly dragging = signal(false);

  // URL del objeto local mientras hay un archivo nuevo sin subir.
  private readonly objectUrl = signal<string | null>(null);
  // Se apaga cuando el usuario quita la imagen existente.
  private readonly keepCurrent = signal(true);

  readonly previewUrl = computed(
    () => this.objectUrl() ?? (this.keepCurrent() ? this.currentUrl() : null),
  );

  readonly savedLabel = computed(() => {
    const p = this.processed();
    if (!p || p.originalBytes <= p.bytes) return '';
    const pct = Math.round((1 - p.bytes / p.originalBytes) * 100);
    return `${pct}% más liviana que el original (${formatBytes(p.originalBytes)})`;
  });

  size(bytes: number): string {
    return formatBytes(bytes);
  }

  constructor() {
    // Un blob: URL vive hasta que se revoca explícitamente. Sin esto, cada
    // imagen probada deja el bitmap retenido durante toda la sesión.
    effect((onCleanup) => {
      const url = this.objectUrl();
      onCleanup(() => {
        if (url) URL.revokeObjectURL(url);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      const url = this.objectUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }

  // Referencia al input propio. Un querySelector global tomaría el primer
  // input del documento, que con dos pickers en pantalla sería el equivocado.
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  openPicker(): void {
    if (this.busy() || this.disabled()) return;
    this.fileInput()?.nativeElement.click();
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (this.busy() || this.disabled()) return;
    this.dragging.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    if (this.busy() || this.disabled()) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) void this.handle(file);
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    // Se limpia para que elegir el mismo archivo dos veces vuelva a disparar.
    input.value = '';
    if (file) void this.handle(file);
  }

  private async handle(file: File): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await this.processor.process(file);

      // La URL anterior la revoca el cleanup del effect al cambiar la señal.
      this.processed.set(result);
      this.objectUrl.set(URL.createObjectURL(result.file));
      this.keepCurrent.set(true);
      this.changed.emit(result);
    } catch (err: unknown) {
      this.error.set(
        err instanceof ImageValidationError
          ? err.message
          : 'No se pudo procesar la imagen.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  clear(): void {
    this.objectUrl.set(null);
    this.processed.set(null);
    this.keepCurrent.set(false);
    this.error.set(null);
    this.changed.emit(null);
    this.removed.emit();
  }
}
