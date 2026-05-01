import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Client } from '../../../../../../models/client.model';

@Component({
  selector: 'app-admin-clients-list',
  imports: [DatePipe],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsListComponent {
  readonly clients = input.required<Client[]>();
  readonly loading = input<boolean>(false);
  readonly edit = output<Client>();
  readonly remove = output<Client>();
}
