import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
type ModalChrome = 'full' | 'bare';

// Ventana modal genérica: backdrop blureado, panel centrado con entrada
// animada, cierre por click fuera / X / Escape y bloqueo del scroll de fondo.
//
// Dos modos:
//   · chrome="full" → el modal dibuja su propia superficie, header con título
//     y cuerpo con padding. Para contenido suelto.
//   · chrome="bare" → el modal solo posiciona y anima; la superficie la pone el
//     contenido proyectado. Es el modo que usan los formularios existentes,
//     que ya traen su card con encabezado y botonera propios: así se vuelven
//     ventana sin duplicar bordes ni títulos.
//
// Mientras busy() es true no cierra por ninguna vía: evita que un submit en
// vuelo pierda el formulario por un Escape o un click accidental.
@Component({
  selector: 'app-modal-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <!--
      El contenido proyectado se declara UNA sola vez acá y las dos ramas de
      chrome lo instancian con ngTemplateOutlet.

      No repetir <ng-content> por rama es obligatorio, no estético: dos
      <ng-content> en el mismo template hacen que Angular declare dos slots de
      proyección (ngContentSelectors = ['*', '*']), y cuando hay varios slots
      comodín el contenido va TODO al último. La rama bare —la que usan todos
      los formularios del CRUD— quedaba con el slot vacío, así que el modal se
      abría como un backdrop borroso sin formulario adentro.
    -->
    <ng-template #projected><ng-content /></ng-template>

    @if (open()) {
      <div
        class="m-backdrop fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
        (click)="onBackdrop()"
      >
        @if (chrome() === 'bare') {
          <!-- El contenido trae su propia superficie. -->
          <div
            class="m-panel m-panel-bare w-full my-auto"
            [class]="widthClass()"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="title()"
            (click)="$event.stopPropagation()"
          >
            <ng-container [ngTemplateOutlet]="projected" />
          </div>
        } @else {
          <div
            class="m-panel w-full bg-elevated backdrop-blur-xl border border-border-subtle rounded-2xl shadow-2xl shadow-black/25 my-auto flex flex-col max-h-[calc(100vh-2rem)]"
            [class]="widthClass()"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="title()"
            (click)="$event.stopPropagation()"
          >
            <!-- Header -->
            <div class="flex items-start gap-4 px-6 py-5 border-b border-border-subtle flex-shrink-0">
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-bold text-foreground tracking-tight">{{ title() }}</h3>
                @if (subtitle(); as sub) {
                  <p class="text-sm text-foreground-muted mt-0.5">{{ sub }}</p>
                }
              </div>
              <button
                type="button"
                (click)="requestClose()"
                [disabled]="busy()"
                aria-label="Cerrar"
                class="icon-btn press w-8 h-8 -mr-1 -mt-1 inline-flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <!-- Cuerpo scrolleable -->
            <div class="px-6 py-5 overflow-y-auto flex-1 min-h-0">
              <ng-container [ngTemplateOutlet]="projected" />
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ModalShellComponent {
  private readonly doc = inject(DOCUMENT);

  readonly open = input<boolean>(false);
  // En modo bare solo se usa como aria-label; el título visible lo pone el contenido.
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly size = input<ModalSize>('lg');
  readonly chrome = input<ModalChrome>('full');
  // Bloquea el cierre mientras hay una operación en vuelo.
  readonly busy = input<boolean>(false);

  readonly closed = output<void>();

  readonly widthClass = computed(() => {
    switch (this.size()) {
      case 'sm': return 'max-w-md';
      case 'md': return 'max-w-xl';
      case 'xl': return 'max-w-5xl';
      default: return 'max-w-3xl';
    }
  });

  // Congela el scroll del fondo mientras el modal está abierto y lo libera al
  // cerrar o al destruir el componente (navegar con el modal abierto dejaría
  // el body bloqueado para siempre).
  constructor() {
    effect(() => {
      this.doc.body.classList.toggle('modal-open', this.open());
    });
    inject(DestroyRef).onDestroy(() => {
      this.doc.body.classList.remove('modal-open');
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.requestClose();
  }

  onBackdrop(): void {
    this.requestClose();
  }

  requestClose(): void {
    if (this.busy()) return;
    this.closed.emit();
  }
}
