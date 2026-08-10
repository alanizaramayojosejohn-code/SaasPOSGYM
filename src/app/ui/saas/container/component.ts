import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import { SidebarService } from '../../../services/layout/sidebar.service';
import { BurgerButtonComponent } from '../../shared/burger-button.component';
import { ThemeModeToggleComponent } from '../../shared/theme-mode-toggle.component';

@Component({
  selector: 'app-saas-container',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeModeToggleComponent, BurgerButtonComponent],
  templateUrl: './component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaasContainerComponent {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly sidebar = inject(SidebarService);

  readonly audienceLabel = 'SaaS';

  readonly initials = computed(() => {
    const name = this.auth.profile()?.name?.trim() ?? '';
    if (!name) return '··';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
