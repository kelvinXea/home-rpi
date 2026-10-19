import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Menu } from '@home-rpi/contracts';
import { Observable, map } from 'rxjs';

/** Se lanza si la API responde con una forma distinta al contrato `Menu[]`. */
export class MenusContractError extends Error {}

function isMenu(value: unknown): value is Menu {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m['id'] === 'string' &&
    typeof m['commerce'] === 'string' &&
    Array.isArray(m['products']) &&
    m['products'].every((p: unknown) => {
      const prod = p as Record<string, unknown> | null;
      return (
        typeof prod === 'object' &&
        prod !== null &&
        typeof prod['product'] === 'string' &&
        typeof prod['price'] === 'number' &&
        Number.isInteger(prod['price'])
      );
    })
  );
}

/** URL relativa: en dev la resuelve `proxy.conf.json`; en Docker, el proxy de nginx. */
@Service()
export class MenusService {
  private readonly http = inject(HttpClient);

  list(): Observable<Menu[]> {
    return this.http.get<unknown>('/api/menus').pipe(
      map((body) => {
        if (!Array.isArray(body) || !body.every(isMenu)) {
          throw new MenusContractError('La respuesta de /api/menus no cumple el contrato Menu[]');
        }
        return body;
      }),
    );
  }
}
