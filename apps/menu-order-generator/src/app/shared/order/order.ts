import type { Menu, MenuProduct } from '@home-rpi/contracts';

export interface OrderLine {
  product: MenuProduct;
  quantity: number;
  amount: number;
}

/** Importe de una línea: precio unitario × cantidad. */
export function lineAmount(product: MenuProduct, quantity: number): number {
  return product.price * quantity;
}

/** Cantidad tras sumar `delta`, sin bajar de 0. */
export function adjustQuantity(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

/** Líneas con cantidad > 0. `quantities[i]` corresponde a `menu.products[i]`. */
export function orderLines(menu: Menu | null, quantities: readonly number[]): OrderLine[] {
  if (!menu) return [];
  return menu.products.flatMap((product, i) => {
    const quantity = quantities[i] ?? 0;
    return quantity > 0 ? [{ product, quantity, amount: lineAmount(product, quantity) }] : [];
  });
}

export function orderTotal(lines: readonly OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

/** Texto compartible: una línea `Nx Producto` por producto y total. */
export function buildShareText(lines: readonly OrderLine[], formattedTotal: string): string {
  return [
    ...lines.map((l) => `${l.quantity}x ${l.product.product}`),
    `Total: ${formattedTotal}`,
  ].join('\n');
}
