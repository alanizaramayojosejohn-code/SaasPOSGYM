import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

/**
 * Revela el elemento cuando entra en el viewport.
 *
 * El scroll reveal no se puede hacer solo con CSS: hay que saber cuándo el
 * elemento entra en pantalla. Se usa IntersectionObserver, que corre fuera del
 * hilo principal y no cuesta nada — a diferencia de escuchar el evento scroll,
 * que dispara decenas de veces por segundo y obliga a leer el layout.
 *
 * El elemento arranca oculto por la clase `reveal` (definida en styles.css) y
 * la clase `is-in` lo trae. Si el usuario pidió menos movimiento, se revela de
 * inmediato y no se observa nada.
 */
@Directive({
  selector: '[appReveal]',
  host: { class: 'reveal' },
})
export class RevealDirective {
  private readonly el = inject(ElementRef<HTMLElement>);

  /**
   * Retardo en ms, para escalonar un grupo de elementos.
   *
   * Con transform para aceptar tanto `appReveal="150"` (atributo estático, que
   * llega como string) como `[appReveal]="i * 70"` (binding, que llega número).
   */
  readonly appReveal = input(0, { transform: toDelay });

  constructor() {
    const destroyRef = inject(DestroyRef);

    // afterNextRender: el observador necesita el nodo ya en el documento, y
    // además así nunca corre en un render de servidor.
    afterNextRender(() => {
      const node = this.el.nativeElement as HTMLElement;

      const delay = this.appReveal();
      if (delay > 0) node.style.transitionDelay = `${delay}ms`;

      const prefersReduced =
        typeof matchMedia === 'function' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced || typeof IntersectionObserver === 'undefined') {
        node.classList.add('is-in');
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-in');
            // Se revela una sola vez: volver a ocultar al salir de pantalla
            // marea al hacer scroll hacia arriba.
            observer.unobserve(entry.target);
          }
        },
        // El margen negativo abajo hace que entre cuando ya se ve de verdad,
        // no cuando asoma un píxel.
        { threshold: 0.1, rootMargin: '0px 0px -10% 0px' },
      );

      observer.observe(node);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

/** `appReveal` sin valor equivale a sin retardo. */
function toDelay(value: number | string | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
