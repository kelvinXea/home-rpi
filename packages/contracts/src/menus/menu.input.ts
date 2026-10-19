import { type Static, Type } from "typebox";
import { NonBlankString } from "../shared/primitives.ts";
import { MenuProduct } from "./menu.schema.ts";

/** Cuerpo de POST /api/menus y PUT /api/menus/:id: el cliente nunca envía `id`. */
export const MenuInput = Type.Object(
  {
    commerce: NonBlankString,
    products: Type.Array(MenuProduct),
  },
  { additionalProperties: false, $id: "MenuInput" },
);

export type MenuInput = Static<typeof MenuInput>;
