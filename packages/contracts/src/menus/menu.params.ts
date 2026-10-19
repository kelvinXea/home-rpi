import { type Static, Type } from "typebox";

/** Parámetro de ruta `:id` de /api/menus/:id. */
export const MenuIdParams = Type.Object({ id: Type.String({ minLength: 1 }) }, { additionalProperties: false });

export type MenuIdParams = Static<typeof MenuIdParams>;
