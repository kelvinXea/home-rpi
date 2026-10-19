import type { Menu } from '@home-rpi/contracts';
import { adjustQuantity, buildShareText, orderLines, orderTotal } from './order';

const menu: Menu = {
  id: 'a',
  commerce: 'Pepezolano',
  products: [
    { product: 'Producto 1', price: 5000 },
    { product: 'Producto 2', price: 2500 },
    { product: 'Producto 3', price: 100 },
  ],
};

describe('order', () => {
  it('no baja de 0', () => {
    expect(adjustQuantity(0, -1)).toBe(0);
    expect(adjustQuantity(2, 1)).toBe(3);
  });

  it('omite líneas con cantidad 0 y calcula importes y total', () => {
    const lines = orderLines(menu, [2, 0, 4]);
    expect(lines.map((l) => [l.product.product, l.quantity, l.amount])).toEqual([
      ['Producto 1', 2, 10000],
      ['Producto 3', 4, 400],
    ]);
    expect(orderTotal(lines)).toBe(10400);
  });

  it('pedido vacío o sin menú', () => {
    expect(orderLines(menu, [0, 0, 0])).toEqual([]);
    expect(orderLines(null, [])).toEqual([]);
    expect(orderTotal([])).toBe(0);
  });

  it('texto compartido con formato Nx Producto', () => {
    const text = buildShareText(orderLines(menu, [5, 2, 0]), '27.500');
    expect(text).toBe('5x Producto 1\n2x Producto 2\nTotal: 27.500');
  });
});
