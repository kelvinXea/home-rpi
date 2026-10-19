import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Menu } from '@home-rpi/contracts';
import { MenuOrderPage } from './menu-order-page';
import { ShareService } from '../shared/share/share.service';

const menus: Menu[] = [
  { id: 'id-1', commerce: 'Pepezolano', products: [{ product: 'Pizza', price: 5000 }, { product: 'Pasta', price: 3000 }] },
  { id: 'id-2', commerce: 'El hediondito', products: [{ product: 'Taco', price: 100 }] },
];

describe('MenuOrderPage', () => {
  let http: HttpTestingController;
  let shareMock: { share: ReturnType<typeof vi.fn> };

  async function setup(response: Menu[] | null = menus) {
    shareMock = { share: vi.fn().mockResolvedValue('copied') };
    TestBed.configureTestingModule({
      imports: [MenuOrderPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ShareService, useValue: shareMock }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MenuOrderPage);
    fixture.detectChanges();
    if (response) http.expectOne('/api/menus').flush(response);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
  const buttons = (root: HTMLElement) => Array.from(root.querySelectorAll('button'));
  const click = async (f: { detectChanges(): void; whenStable(): Promise<unknown> }, b: Element) => {
    (b as HTMLButtonElement).click();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
  };

  async function choose(f: Awaited<ReturnType<typeof setup>>, id: string) {
    const select = el(f).querySelector('select')!;
    select.value = id;
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
  }

  afterEach(() => http.verify());

  it('muestra commerce como etiqueta e id como valor', async () => {
    const f = await setup();
    const options = Array.from(el(f).querySelectorAll('option')).filter((o) => o.value);
    expect(options.map((o) => [o.textContent, o.value])).toEqual([
      ['Pepezolano', 'id-1'],
      ['El hediondito', 'id-2'],
    ]);
  });

  it('estado vacío cuando la API devuelve []', async () => {
    const f = await setup([]);
    expect(el(f).textContent).toContain('No hay menús disponibles');
  });

  it('muestra error y permite reintentar', async () => {
    const f = await setup(null);
    http.expectOne('/api/menus').flush('x', { status: 500, statusText: 'Server Error' });
    f.detectChanges();
    expect(el(f).querySelector('[role=alert]')?.textContent).toContain('500');
    await click(f, buttons(el(f)).find((b) => b.textContent?.includes('Reintentar'))!);
    http.expectOne('/api/menus').flush(menus);
  });

  it('identifica respuestas que no cumplen el contrato', async () => {
    const f = await setup(null);
    http.expectOne('/api/menus').flush([{ id: 1 }]);
    f.detectChanges();
    expect(el(f).textContent).toContain('no cumple el contrato');
  });

  it('cantidades, total, límite en 0, compartir y reinicio al cambiar de menú', async () => {
    const f = await setup();
    await choose(f, 'id-1');
    const plus = (name: string) => el(f).querySelector(`button[aria-label="Añadir una unidad de ${name}"]`)!;
    const minus = (name: string) => el(f).querySelector<HTMLButtonElement>(`button[aria-label="Quitar una unidad de ${name}"]`)!;
    const share = () => buttons(el(f)).find((b) => b.textContent?.trim() === 'Compartir pedido')!;

    expect(share().disabled).toBe(true);
    expect(minus('Pizza').disabled).toBe(true);
    expect(el(f).textContent).toContain('Aún no has seleccionado');

    await click(f, plus('Pizza'));
    await click(f, plus('Pizza'));
    await click(f, plus('Pasta'));
    expect(el(f).querySelector('[data-testid=total]')?.textContent).toBe(new Intl.NumberFormat('es', { maximumFractionDigits: 0 }).format(13000));
    expect(share().disabled).toBe(false);

    await click(f, share());
    expect(shareMock.share).toHaveBeenCalledWith(expect.stringContaining('2x Pizza\n1x Pasta'), 'Pedido Pepezolano');
    expect(el(f).textContent).toContain('copiado al portapapeles');

    await choose(f, 'id-2');
    expect(el(f).textContent).toContain('Aún no has seleccionado');
    expect(share().disabled).toBe(true);
  });

  it('muestra texto de respaldo si falla compartir', async () => {
    const f = await setup();
    await choose(f, 'id-2');
    shareMock.share.mockResolvedValue('failed');
    await click(f, el(f).querySelector('button[aria-label="Añadir una unidad de Taco"]')!);
    await click(f, buttons(el(f)).find((b) => b.textContent?.trim() === 'Compartir pedido')!);
    expect(el(f).querySelector<HTMLTextAreaElement>('textarea')?.value).toContain('1x Taco');
  });

  it('compartir cancelado no es un error', async () => {
    const f = await setup();
    await choose(f, 'id-2');
    shareMock.share.mockResolvedValue('cancelled');
    await click(f, el(f).querySelector('button[aria-label="Añadir una unidad de Taco"]')!);
    await click(f, buttons(el(f)).find((b) => b.textContent?.trim() === 'Compartir pedido')!);
    expect(el(f).querySelector('.alert-danger')).toBeNull();
    expect(el(f).textContent).toContain('cancelado');
  });
});
