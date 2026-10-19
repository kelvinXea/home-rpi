import { TestBed } from '@angular/core/testing';
import { OrderSummary } from './order-summary';

describe('OrderSummary', () => {
  function setup(lines: { product: { product: string; price: number }; quantity: number; amount: number }[], total: number) {
    const fixture = TestBed.createComponent(OrderSummary);
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('formatPrice', (v: number) => `$${v}`);
    fixture.detectChanges();
    return fixture;
  }

  const shareButton = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Compartir pedido')!;

  it('pedido vacío: mensaje y botón deshabilitado', () => {
    const root = setup([], 0).nativeElement as HTMLElement;
    expect(root.textContent).toContain('Aún no has seleccionado');
    expect(shareButton(root).disabled).toBe(true);
  });

  it('muestra líneas y total, y emite share', () => {
    const fixture = setup([{ product: { product: 'Pizza', price: 5000 }, quantity: 2, amount: 10000 }], 10000);
    const root = fixture.nativeElement as HTMLElement;
    let shared = 0;
    fixture.componentInstance.share.subscribe(() => shared++);
    expect(root.textContent).toContain('2x Pizza');
    expect(root.querySelector('[data-testid=total]')?.textContent).toBe('$10000');
    shareButton(root).click();
    expect(shared).toBe(1);
  });
});
