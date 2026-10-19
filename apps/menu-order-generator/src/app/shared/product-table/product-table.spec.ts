import { TestBed } from '@angular/core/testing';
import { ProductTable, QuantityChange } from './product-table';

const products = [
  { product: 'Pizza', price: 5000 },
  { product: 'Pasta', price: 3000 },
];

describe('ProductTable', () => {
  function setup(items = products, quantities = [2, 0]) {
    const fixture = TestBed.createComponent(ProductTable);
    fixture.componentRef.setInput('products', items);
    fixture.componentRef.setInput('quantities', quantities);
    fixture.componentRef.setInput('formatPrice', (v: number) => `$${v}`);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra nombre, precio y cantidad de cada producto', () => {
    const text = (setup().nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Pizza');
    expect(text).toContain('$5000');
    expect(text).toContain('$3000');
  });

  it('emite índice y delta al pulsar + y −, y deshabilita − en 0', () => {
    const fixture = setup();
    const root = fixture.nativeElement as HTMLElement;
    const emitted: QuantityChange[] = [];
    fixture.componentInstance.quantityChange.subscribe((c) => emitted.push(c));

    root.querySelector<HTMLButtonElement>('button[aria-label="Añadir una unidad de Pasta"]')!.click();
    root.querySelector<HTMLButtonElement>('button[aria-label="Quitar una unidad de Pizza"]')!.click();

    expect(emitted).toEqual([
      { index: 1, delta: 1 },
      { index: 0, delta: -1 },
    ]);
    expect(root.querySelector<HTMLButtonElement>('button[aria-label="Quitar una unidad de Pasta"]')!.disabled).toBe(true);
  });

  it('informa cuando el menú no tiene productos', () => {
    expect((setup([], []).nativeElement as HTMLElement).textContent).toContain('no tiene productos');
  });
});
