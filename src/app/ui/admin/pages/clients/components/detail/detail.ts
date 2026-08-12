import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Client } from '../../../../../../models/client.model';
import { DetailFieldComponent } from '../../../../../shared/detail-field.component';

@Component({
  selector: 'app-admin-clients-detail',
  imports: [DatePipe, DetailFieldComponent],
  templateUrl: './detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsDetailComponent {
  readonly value = input.required<Client>();
  readonly edit = output<void>();
  readonly closed = output<void>();

  readonly initials = computed(() => {
    const parts = this.value().name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });
}
