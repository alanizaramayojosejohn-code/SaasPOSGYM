import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ThemeService } from '../../../services/theme/theme.service';

@Component({
  selector: 'app-public-container',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicContainerComponent {
  protected readonly theme = inject(ThemeService);
}
