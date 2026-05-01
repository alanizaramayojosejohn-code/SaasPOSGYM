import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Profile } from '../../../../../../models/profile.model';

@Component({
  selector: 'app-admin-users-list',
  imports: [DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersListComponent {
  readonly users = input.required<Profile[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<Profile>();
  readonly remove = output<Profile>();
}
