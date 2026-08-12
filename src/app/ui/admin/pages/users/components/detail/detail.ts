import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Profile } from '../../../../../../models/profile.model';
import { DetailFieldComponent } from '../../../../../shared/detail-field.component';

@Component({
  selector: 'app-admin-users-detail',
  imports: [DatePipe, DetailFieldComponent],
  templateUrl: './detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersDetailComponent {
  readonly value = input.required<Profile>();
  readonly edit = output<void>();
  readonly closed = output<void>();

  readonly initials = computed(() => {
    const parts = this.value().name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });

  readonly roleLabel = computed(() => {
    switch (this.value().role) {
      case 'admin': return 'Administrador';
      case 'caja': return 'Cajero';
      default: return 'Super admin';
    }
  });
}
