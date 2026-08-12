import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Business } from '../../../../../../models/business.model';
import { getPreset } from '../../../../../../services/theme/theme.presets';
import { DetailFieldComponent } from '../../../../../shared/detail-field.component';

@Component({
  selector: 'app-saas-businesses-detail',
  imports: [DatePipe, DetailFieldComponent],
  templateUrl: './detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessesDetailComponent {
  readonly value = input.required<Business>();
  readonly edit = output<void>();
  readonly closed = output<void>();

  readonly initials = computed(() => {
    const parts = this.value().name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });

  readonly typeLabel = computed(() => (this.value().type === 'gym' ? 'Gimnasio' : 'POS'));

  readonly preset = computed(() => getPreset(this.value().theme?.preset));
}
