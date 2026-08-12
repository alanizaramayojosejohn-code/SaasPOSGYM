import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Par label/valor de una vista de detalle (solo lectura). Lo usan los
// componentes detail.* de admin y saas: es agnóstico de entidad, así que
// vive en ui/shared en vez de duplicarse por CRUD.
@Component({
  selector: 'app-detail-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <p class="text-xs font-medium text-foreground-faint uppercase tracking-wide mb-1">{{ label() }}</p>
      <div class="text-sm text-foreground" [class.font-mono]="mono()" [class.text-foreground-faint]="empty()">
        <ng-content />
      </div>
    </div>
  `,
})
export class DetailFieldComponent {
  readonly label = input.required<string>();
  readonly mono = input<boolean>(false);
  // Atenúa el valor cuando el contenido proyectado es un placeholder ("—").
  readonly empty = input<boolean>(false);
}
