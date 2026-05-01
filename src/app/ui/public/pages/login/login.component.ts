import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../services/auth/auth.service';
import { errorMessage } from '../../../../utilities/error-message';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      await this.navigateByRole();
    } catch (err: unknown) {
      const msg = errorMessage(err, 'Error al iniciar sesión');
      this.error.set(this.translateError(msg));
    } finally {
      this.loading.set(false);
    }
  }

  async loginWithGoogle(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.loginWithGoogle();
      // El navegador redirige a Google; control no vuelve aquí salvo error.
    } catch (err: unknown) {
      const msg = errorMessage(err, 'Error con Google');
      this.error.set(msg);
      this.loading.set(false);
    }
  }

  private async navigateByRole(): Promise<void> {
    switch (this.auth.role()) {
      case 'super_admin':
        await this.router.navigateByUrl('/saas');
        break;
      case 'admin':
        await this.router.navigateByUrl('/admin');
        break;
      case 'caja':
        await this.router.navigateByUrl('/caja');
        break;
      default:
        this.error.set('Tu usuario no tiene un rol asignado.');
    }
  }

  private translateError(msg: string): string {
    if (msg.toLowerCase().includes('invalid login credentials')) {
      return 'Email o contraseña incorrectos';
    }
    return msg;
  }
}
