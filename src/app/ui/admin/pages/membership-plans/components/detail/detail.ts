import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MembershipPlanWithServices } from '../../../../../../models/membership-plan.model';
import { DetailFieldComponent } from '../../../../../shared/detail-field.component';

@Component({
  selector: 'app-admin-membership-plans-detail',
  imports: [CurrencyPipe, DetailFieldComponent],
  templateUrl: './detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembershipPlansDetailComponent {
  readonly value = input.required<MembershipPlanWithServices>();
  readonly edit = output<void>();
  readonly closed = output<void>();

  readonly initials = computed(() => {
    const parts = this.value().name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  });
}
