import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

// Modal de confirmación de borrado replicando el diseño del pencil:
// backdrop blureado, card centrado con icon-box negra arriba, título,
// descripción, summary card de la entidad, campo "Escribe X" para confirmar
// (opcional segun confirmWord), footer con Cancelar + Eliminar danger.
//
// Diseño "type to confirm" copia el patrón GitHub/Stripe: para borrados
// con cascada (negocios, socios, colaboradores) requiere tipear la palabra.
// Para borrados livianos (productos, planes) confirmWord queda en null y
// el botón Eliminar se habilita inmediato.
@Component({
  selector: 'app-confirm-delete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <!-- Backdrop. Click cierra. -->
      <div class="m-backdrop fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
           (click)="onBackdropClick($event)">
        <!-- Card. Stop propagation para que click adentro NO cierre. -->
        <div class="m-panel w-full max-w-md bg-elevated backdrop-blur-xl border border-border-subtle rounded-2xl shadow-2xl shadow-black/20 overflow-hidden"
             role="dialog"
             aria-modal="true"
             (click)="$event.stopPropagation()">
          <!-- Header: icon + title + description -->
          <div class="px-7 pt-7 pb-5 flex flex-col items-center text-center gap-4">
            <div class="w-16 h-16 rounded-2xl bg-foreground text-base flex items-center justify-center shadow-lg shadow-black/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold text-foreground tracking-tight">{{ title() }}</h3>
              <p class="text-sm text-foreground-muted mt-1.5 leading-relaxed">{{ description() }}</p>
            </div>
          </div>

          <!-- Body: entity summary card (siempre visible si hay label) -->
          <div class="px-7 pb-5 space-y-4">
            @if (entityLabel(); as label) {
              <div class="flex items-center gap-3 p-3 rounded-xl bg-input border border-border-subtle">
                <div class="w-10 h-10 rounded-full bg-foreground text-base flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {{ entityInitials() || '··' }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-foreground truncate">{{ label }}</p>
                  @if (entitySublabel(); as sub) {
                    <p class="text-xs text-foreground-subtle truncate">{{ sub }}</p>
                  }
                </div>
                @if (amount(); as amt) {
                  <div class="text-right flex-shrink-0">
                    <p class="text-sm font-bold font-mono text-foreground">{{ amt }}</p>
                    @if (amountLabel(); as al) {
                      <p class="text-[10px] text-foreground-faint uppercase tracking-wider">{{ al }}</p>
                    }
                  </div>
                }
              </div>
            }

            <!-- "Escribe X para confirmar" (solo si confirmWord esta seteado) -->
            @if (confirmWord(); as word) {
              <div>
                <label class="block text-xs font-semibold text-foreground-muted mb-1.5">
                  Escribe <span class="font-bold text-foreground">{{ word }}</span> para confirmar
                </label>
                <input type="text"
                       [value]="typedValue()"
                       (input)="onTypeInput($any($event.target).value)"
                       autocomplete="off"
                       class="w-full px-3 py-2 bg-input text-foreground font-mono tracking-wider border rounded-lg outline-none transition placeholder:text-foreground-faint"
                       [class.border-foreground]="typedValue() === word"
                       [class.ring-2]="typedValue() === word"
                       [class.ring-foreground/30]="typedValue() === word"
                       [class.border-border-subtle]="typedValue() !== word" />
              </div>
            }
          </div>

          <!-- Footer: warning + acciones -->
          <div class="px-7 py-4 flex items-center justify-between gap-3 border-t border-border-subtle">
            <div class="flex items-center gap-1.5 text-foreground-subtle text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
              </svg>
              No se puede deshacer
            </div>
            <div class="flex gap-2">
              <button type="button"
                      (click)="onCancel()"
                      class="press px-4 py-1.5 text-sm font-semibold bg-elevated border border-border-subtle text-foreground hover:bg-muted rounded-lg transition">
                Cancelar
              </button>
              <button type="button"
                      (click)="onConfirm()"
                      [disabled]="!canConfirm()"
                      class="press px-4 py-1.5 text-sm font-bold bg-danger text-white hover:bg-danger/90 disabled:bg-muted disabled:text-foreground-faint disabled:cursor-not-allowed rounded-lg transition shadow-md shadow-danger/20 disabled:shadow-none flex items-center gap-1.5">
                @if (submitting()) {
                  Eliminando…
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  </svg>
                  {{ confirmLabel() }}
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDeleteModalComponent {
  // Visibilidad — el padre controla el open/close.
  readonly open = input<boolean>(false);

  // Texto principal del modal.
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly confirmLabel = input<string>('Eliminar');

  // Summary de la entidad a borrar (todo opcional — si no se pasan,
  // el modal queda solo con el título y el botón).
  readonly entityLabel = input<string | null>(null);
  readonly entitySublabel = input<string | null>(null);
  readonly entityInitials = input<string | null>(null);
  readonly amount = input<string | null>(null);
  readonly amountLabel = input<string | null>(null);

  // Si se pasa, requiere que el usuario tipee esa palabra para confirmar.
  // Patrón "type to confirm" — útil para borrados con cascada.
  readonly confirmWord = input<string | null>(null);

  // Cuando submitting=true muestra spinner y deshabilita el botón.
  readonly submitting = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  // Estado interno del input "type to confirm".
  readonly typedValue = signal<string>('');

  // Limpia el input cada vez que el modal se cierra/abre.
  constructor() {
    effect(() => {
      // Watcher sobre open(): al cerrar reseteamos el typed.
      if (!this.open()) this.typedValue.set('');
    });
  }

  readonly canConfirm = computed(() => {
    if (this.submitting()) return false;
    const word = this.confirmWord();
    if (word) return this.typedValue() === word;
    return true;
  });

  onTypeInput(value: string): void {
    this.typedValue.set(value);
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onBackdropClick(_e: MouseEvent): void {
    if (this.submitting()) return; // no cerrar mientras está borrando
    this.onCancel();
  }
}
