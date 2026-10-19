import { type Static, Type } from "typebox";

/** Forma de las respuestas de error (400, 404, 500) de la API. */
export const ErrorResponse = Type.Object(
  {
    statusCode: Type.Integer(),
    error: Type.String(),
    code: Type.Optional(Type.String()),
    message: Type.Optional(Type.String()),
  },
  { $id: "ErrorResponse" },
);

export type ErrorResponse = Static<typeof ErrorResponse>;
