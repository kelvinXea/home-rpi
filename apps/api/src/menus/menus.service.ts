import type { Menu, MenuInput } from "@home-rpi/contracts";
import type { MenusRepository } from "./menus.repository.ts";

/** Recorta (trim) la entrada ya validada por el schema. */
function normalize(input: MenuInput): MenuInput {
  return {
    commerce: input.commerce.trim(),
    products: input.products.map((p) => ({ product: p.product.trim(), price: p.price })),
  };
}

/** "No encontrado" se devuelve como undefined; los fallos de base de datos se propagan (500). */
export class MenusService {
  constructor(private readonly repository: MenusRepository) {}

  list(): Promise<Menu[]> {
    return this.repository.list();
  }

  get(id: string): Promise<Menu | undefined> {
    return this.repository.findById(id);
  }

  create(input: MenuInput): Promise<Menu> {
    return this.repository.create(normalize(input));
  }

  async update(id: string, input: MenuInput): Promise<Menu | undefined> {
    const data = normalize(input);
    if (!(await this.repository.update(id, data))) return undefined;
    return { id, ...data };
  }

  /** Devuelve el menú eliminado, o undefined si no existía. */
  async delete(id: string): Promise<Menu | undefined> {
    const existing = await this.repository.findById(id);
    if (!existing || !(await this.repository.delete(id))) return undefined;
    return existing;
  }
}
