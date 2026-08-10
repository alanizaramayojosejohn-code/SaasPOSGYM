import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'saasgym.sidebar.collapsed';

// Estado del sidebar, compartido por las tres shells (admin, caja, saas).
//
// - `collapsed` es la preferencia de escritorio: rail angosto solo con iconos.
//   Se persiste en localStorage porque es una decisión que el usuario toma una
//   vez y espera que se respete en cada sesión.
// - `mobileOpen` es el drawer de móvil: efímero, nunca se persiste, y se cierra
//   al navegar.
@Injectable({ providedIn: 'root' })
export class SidebarService {
  readonly collapsed = signal<boolean>(readStored());
  readonly mobileOpen = signal<boolean>(false);

  toggleCollapsed(): void {
    this.collapsed.update((v) => {
      const next = !v;
      writeStored(next);
      return next;
    });
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }
}

// localStorage puede lanzar en modo privado o si el navegador lo bloquea;
// en ese caso arrancamos expandido, que es el default razonable.
function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStored(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* preferencia no persistible: seguimos con el estado en memoria */
  }
}
