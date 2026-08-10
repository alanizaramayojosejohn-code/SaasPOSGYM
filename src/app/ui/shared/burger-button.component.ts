import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

// Botón hamburguesa de tres barras que se transforma en X al abrir.
// La animación vive en styles.css (.burger / .burger.is-open) para que la
// misma curva se comparta con el resto del proyecto.
@Component({
  selector: 'app-burger-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="toggled.emit()"
      [attr.aria-label]="open() ? 'Cerrar menú' : 'Abrir menú'"
      [attr.aria-expanded]="open()"
      class="press p-2 -ml-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-muted transition flex items-center justify-center"
    >
      <span class="burger" [class.is-open]="open()">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </button>
  `,
})
export class BurgerButtonComponent {
  readonly open = input<boolean>(false);
  readonly toggled = output<void>();
}
