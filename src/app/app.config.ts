import { registerLocaleData } from '@angular/common';
import localeEsBO from '@angular/common/locales/es-BO';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './services/auth/auth.service';

// Angular solo trae los datos de en-US compilados. El dashboard de admin pide
// el locale boliviano de forma explícita ({{ now() | date:...:'es-BO' }}) y sin
// registrarlo el DatePipe lanza NG0701 y tumba el render de la página entera.
//
// Se registran los datos SIN cambiar LOCALE_ID a propósito: el token global
// también gobierna el separador de miles y decimales de CurrencyPipe, así que
// moverlo reformatearía todos los precios de la app (Bs. 1,234.56 → 1.234,56)
// como efecto colateral de arreglar una fecha.
registerLocaleData(localeEsBO);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Carga sesión + profile antes de que el router resuelva la primera ruta.
    // Sin esto los guards correrían con role/businessId=null en el primer refresh.
    provideAppInitializer(() => inject(AuthService).initialize()),
  ],
};
