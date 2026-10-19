import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MenusContractError, MenusService } from './menus.service';

describe('MenusService', () => {
  let service: MenusService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MenusService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide GET /api/menus y devuelve los menús válidos', () => {
    const menus = [{ id: 'a', commerce: 'X', products: [{ product: 'P', price: 10 }] }];
    let result: unknown;
    service.list().subscribe((m) => (result = m));
    const req = http.expectOne('/api/menus');
    expect(req.request.method).toBe('GET');
    req.flush(menus);
    expect(result).toEqual(menus);
  });

  it.each([
    ['no es un array', { id: 'a' }],
    ['precio no entero', [{ id: 'a', commerce: 'X', products: [{ product: 'P', price: 1.5 }] }]],
    ['falta commerce', [{ id: 'a', products: [] }]],
  ])('lanza MenusContractError si %s', (_caso, body) => {
    let error: unknown;
    service.list().subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/menus').flush(body);
    expect(error).toBeInstanceOf(MenusContractError);
  });
});
