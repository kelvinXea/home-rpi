import { type Static, Type } from "typebox";
import { NonBlankString } from "../shared/primitives.ts";

/** Producto de un menú. `price`: entero >= 0 (sin cadenas, decimales, negativos ni NaN/Infinity). */
export const MenuProduct = Type.Object(
  {
    product: NonBlankString,
    price: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  },
  { additionalProperties: false, $id: "MenuProduct" },
);

export type MenuProduct = Static<typeof MenuProduct>;

/** Menú expuesto por la API; `id` lo genera el backend. */
export const Menu = Type.Object(
  {
    id: Type.String(),
    commerce: Type.String(),
    products: Type.Array(MenuProduct),
  },
  { additionalProperties: false, $id: "Menu" },
);

export type Menu = Static<typeof Menu>;
