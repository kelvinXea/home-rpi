import { randomUUID } from "node:crypto";
import type { Menu, MenuInput } from "@home-rpi/contracts";
import type { SqliteDb } from "../db.ts";

interface MenuRow {
  id: string;
  commerce: string;
  products: string;
}

function toMenu(row: MenuRow): Menu {
  return { id: row.id, commerce: row.commerce, products: JSON.parse(row.products) as Menu["products"] };
}

/** Acceso a datos de menús: `products` se guarda como JSON en una columna TEXT. */
export class MenusRepository {
  constructor(private readonly db: SqliteDb) {}

  async list(): Promise<Menu[]> {
    const rows = await this.db.all<MenuRow>("SELECT id, commerce, products FROM menus ORDER BY rowid");
    return rows.map(toMenu);
  }

  async findById(id: string): Promise<Menu | undefined> {
    const row = await this.db.get<MenuRow>("SELECT id, commerce, products FROM menus WHERE id = ?", [id]);
    return row && toMenu(row);
  }

  async create(input: MenuInput): Promise<Menu> {
    const id = randomUUID();
    await this.db.run("INSERT INTO menus (id, commerce, products) VALUES (?, ?, ?)", [
      id,
      input.commerce,
      JSON.stringify(input.products),
    ]);
    return { id, ...input };
  }

  /** Devuelve false si no existe ningún menú con ese id. */
  async update(id: string, input: MenuInput): Promise<boolean> {
    const result = await this.db.run(
      "UPDATE menus SET commerce = ?, products = ?, updated_at = datetime('now') WHERE id = ?",
      [input.commerce, JSON.stringify(input.products), id],
    );
    return result.changes > 0;
  }

  /** Devuelve false si no existe ningún menú con ese id. */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.run("DELETE FROM menus WHERE id = ?", [id]);
    return result.changes > 0;
  }
}
