import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type MethodKind = 'cash' | 'card' | 'transfer' | 'check' | 'qr';

interface MethodStyle {
  text: string;
  bg: string;
  border: string;
}

// Identidad de método, fija — no depende del negocio (a diferencia de
// --c-accent). Efectivo=verde (dinero), tarjeta/transferencia=celeste de
// marca (electrónico/banco), QR/cheque=plata (--c-silver).
const METHOD_STYLE: Record<MethodKind, MethodStyle> = {
  cash: { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  card: { text: 'text-brand', bg: 'bg-brand/10', border: 'border-brand/20' },
  transfer: { text: 'text-brand', bg: 'bg-brand/10', border: 'border-brand/20' },
  qr: { text: 'text-silver', bg: 'bg-silver/10', border: 'border-silver/20' },
  check: { text: 'text-silver', bg: 'bg-silver/10', border: 'border-silver/20' },
};

// Badge de método de pago: ícono + color fijo por tipo, consistente en toda
// la app (ventas, factura, nómina). El texto plano gris que había antes no
// distinguía un método de otro — esto sí.
@Component({
  selector: 'app-method-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClass()">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        [attr.width]="compact() ? 10 : 12"
        [attr.height]="compact() ? 10 : 12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0"
      >
        @switch (kind()) {
          @case ('cash') {
            <rect width="20" height="12" x="2" y="6" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 12h.01M18 12h.01" />
          }
          @case ('card') {
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          }
          @case ('transfer') {
            <line x1="3" x2="21" y1="22" y2="22" />
            <line x1="6" x2="6" y1="18" y2="11" />
            <line x1="10" x2="10" y1="18" y2="11" />
            <line x1="14" x2="14" y1="18" y2="11" />
            <line x1="18" x2="18" y1="18" y2="11" />
            <polygon points="12 2 20 7 4 7" />
          }
          @case ('check') {
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
          }
          @case ('qr') {
            <rect width="5" height="5" x="3" y="3" rx="1" />
            <rect width="5" height="5" x="16" y="3" rx="1" />
            <rect width="5" height="5" x="3" y="16" rx="1" />
            <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
            <path d="M21 21v.01" />
            <path d="M12 7v3a2 2 0 0 1-2 2H7" />
            <path d="M3 12h.01" />
            <path d="M12 3h.01" />
            <path d="M12 16v.01" />
            <path d="M16 12h1" />
            <path d="M21 12v.01" />
            <path d="M12 21v-1" />
          }
        }
      </svg>
      {{ label() }}
    </span>
  `,
})
export class MethodBadgeComponent {
  readonly kind = input.required<MethodKind>();
  readonly label = input.required<string>();
  // Variante chica para tarjetas mobile (mismo patrón que el resto de la app).
  readonly compact = input<boolean>(false);

  readonly style = computed(() => METHOD_STYLE[this.kind()]);

  readonly badgeClass = computed(() => {
    const s = this.style();
    const size = this.compact() ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
    return `inline-flex items-center gap-1 font-semibold rounded-full border flex-shrink-0 ${size} ${s.text} ${s.bg} ${s.border}`;
  });
}
