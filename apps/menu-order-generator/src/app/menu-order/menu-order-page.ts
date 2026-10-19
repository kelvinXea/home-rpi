import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { Menu } from '@home-rpi/contracts';
import { MenuSelector } from '../shared/menu-selector/menu-selector';
import { MenusContractError, MenusService } from '../shared/menus/menus.service';
import { OrderSummary } from '../shared/order-summary/order-summary';
import { adjustQuantity, buildShareText, orderLines, orderTotal } from '../shared/order/order';
import { ProductTable, QuantityChange } from '../shared/product-table/product-table';
import { ShareService } from '../shared/share/share.service';

type LoadState = 'loading' | 'ready' | 'error';

const currency = new Intl.NumberFormat('es', { maximumFractionDigits: 0 });

/** Contenedor: carga menús y es el único dueño del estado del pedido. */
@Component({
  selector: 'app-menu-order-page',
  imports: [MenuSelector, ProductTable, OrderSummary],
  styleUrl: './menu-order-page.scss',
  templateUrl: './menu-order-page.html',
})
export class MenuOrderPage implements OnInit {
  private readonly menusService = inject(MenusService);
  private readonly shareService = inject(ShareService);

  protected readonly state = signal<LoadState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly menus = signal<Menu[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly quantities = signal<number[]>([]);
  protected readonly notice = signal<{ kind: 'success' | 'info' | 'danger'; text: string } | null>(null);
  protected readonly fallbackText = signal<string | null>(null);

  protected readonly selectedMenu = computed(
    () => this.menus().find((m) => m.id === this.selectedId()) ?? null,
  );
  protected readonly lines = computed(() => orderLines(this.selectedMenu(), this.quantities()));
  protected readonly total = computed(() => orderTotal(this.lines()));
  protected readonly formatPrice = (value: number): string => currency.format(value);

  ngOnInit(): void {
    this.loadMenus();
  }

  protected loadMenus(): void {
    this.state.set('loading');
    this.menusService.list().subscribe({
      next: (menus) => {
        this.menus.set(menus);
        this.state.set('ready');
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.describeError(err));
        this.state.set('error');
      },
    });
  }

  protected selectMenu(id: string): void {
    this.selectedId.set(id || null);
    this.quantities.set(new Array(this.selectedMenu()?.products.length ?? 0).fill(0));
    this.clearFeedback();
  }

  protected changeQuantity({ index, delta }: QuantityChange): void {
    this.quantities.update((q) => q.map((v, i) => (i === index ? adjustQuantity(v, delta) : v)));
    this.clearFeedback();
  }

  protected async sharePedido(): Promise<void> {
    const menu = this.selectedMenu();
    const lines = this.lines();
    if (!menu || lines.length === 0) return;
    const text = buildShareText(lines);
    this.clearFeedback();
    const result = await this.shareService.share(text, `Pedido ${menu.commerce}`);
    switch (result) {
      case 'shared':
        this.notice.set({ kind: 'success', text: 'Pedido compartido.' });
        break;
      case 'copied':
        this.notice.set({ kind: 'success', text: 'Pedido copiado al portapapeles.' });
        break;
      case 'cancelled':
        this.notice.set({ kind: 'info', text: 'Compartir cancelado. El pedido sigue intacto.' });
        break;
      case 'failed':
        this.notice.set({
          kind: 'danger',
          text: 'No se pudo compartir ni copiar automáticamente. Copia el texto de abajo.',
        });
        this.fallbackText.set(text);
        break;
    }
  }

  private clearFeedback(): void {
    this.notice.set(null);
    this.fallbackText.set(null);
  }

  private describeError(err: unknown): string {
    if (err instanceof MenusContractError) return err.message;
    if (err instanceof HttpErrorResponse) {
      return err.status === 0
        ? 'No se pudo conectar con la API.'
        : `La API respondió con el error ${err.status}.`;
    }
    return 'Error inesperado al cargar los menús.';
  }
}
