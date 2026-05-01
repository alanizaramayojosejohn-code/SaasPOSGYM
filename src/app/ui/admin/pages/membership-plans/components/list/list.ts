import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MembershipPlanWithServices } from '../../../../../../models/membership-plan.model';

@Component({
  selector: 'app-admin-membership-plans-list',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembershipPlansListComponent {
  readonly plans = input.required<MembershipPlanWithServices[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<MembershipPlanWithServices>();
  readonly remove = output<MembershipPlanWithServices>();
}
