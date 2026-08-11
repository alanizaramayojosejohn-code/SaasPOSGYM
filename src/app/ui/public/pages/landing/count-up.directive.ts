import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

/**
 * Cuenta desde 0 hasta el valor cuando el número entra en pantalla.
 *
 * Escribe directamente en textContent en vez de pasar por una señal: son 60
 * actualizaciones por segundo y hacer pasar cada una por la detección de
 * cambios de Angular haría trabajar a toda la vista para repintar un dígito.
 */
@Directive({
  selector: '[appCountUp]',
})
export class CountUpDirective {
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly appCountUp = input.required<number>();
  readonly prefix = input<string>('');
  readonly suffix = input<string>('');
  readonly durationMs = input<number>(1400);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const node = this.el.nativeElement as HTMLElement;
      const target = this.appCountUp();

      const render = (value: number) => {
        node.textContent = `${this.prefix()}${Math.round(value).toLocaleString('es-BO')}${this.suffix()}`;
      };

      const prefersReduced =
        typeof matchMedia === 'function' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced || typeof IntersectionObserver === 'undefined') {
        render(target);
        return;
      }

      render(0);
      let frame = 0;

      const run = () => {
        const duration = this.durationMs();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutExpo: arranca rápido y frena, que es como se lee un contador.
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          render(target * eased);
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      };

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            run();
          }
        },
        { threshold: 0.5 },
      );

      observer.observe(node);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      });
    });
  }
}
