import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Business } from '../../../../../../models/business.model';
import { getPreset } from '../../../../../../services/theme/theme.presets';

@Component({
  selector: 'app-saas-businesses-list',
  imports: [DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessesListComponent {
  readonly businesses = input.required<Business[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<Business>();
  readonly remove = output<Business>();

  // Para el swatch en la fila: pintamos un circulo con el primary del preset
  // del negocio. Asi el super_admin ve de un vistazo que paleta tiene cada uno.
  // getPreset() ya cae a monochrome si la clave es invalida o falta.
  primaryColor(business: Business): string {
    return getPreset(business.theme?.preset).light.primary;
  }

  presetLabel(business: Business): string {
    return getPreset(business.theme?.preset).label;
  }
}
