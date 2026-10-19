import { Type } from "typebox";

/** Cadena con al menos un carácter no blanco; el servicio la guarda recortada (trim). */
export const NonBlankString = Type.String({ pattern: "\\S" });
